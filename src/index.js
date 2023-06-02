import React, {useRef, useState, useEffect} from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  SafeAreaView,
  Alert,
  StatusBar,
  AppState,
  BackHandler,
  ToastAndroid,
  Button
} from 'react-native';

import SystemSetting from 'react-native-system-setting'
import Slider from '@react-native-community/slider';
import Geolocation from 'react-native-geolocation-service';

import UnlockSlider from 'react-native-unlock-slider'

import { getStatusBarHeight } from 'react-native-status-bar-height';

import { useDispatch, useSelector } from "react-redux";
import { useIsFocused } from '@react-navigation/native';
import * as APIS from "../../services/network";

import { open, close } from '../../redux/popupSlice';
import { logOut, setData, menuOpen, noticeOpen, loadingEnd, gpsUpdate, reloadInfo } from '../../redux/usersSlice';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';


import FastImage from 'react-native-fast-image';
import ButtonGr from '../../components/ButtonGr';
import CheckBox from '../../components/CheckBox';
import BlackText from '../../components/BlackText';
import Select from '../../components/Select';
import Svg from '../../components/Svg';
import Input from '../../components/Input';
import Toggle from '../../components/Toggle';

import RootLayout from '../../layouts/RootLayout';
import images from '../../libs/images';
import fonts from '../../libs/fonts';
import routes from '../../libs/routes';
import rootStyle from '../../libs/rootStyle';
import consts from '../../libs/consts';

import { SCREENHEIGHT, SCREENWIDTH, findJson, findJsonKey, statusChange } from '../../services/utils';
import VIForegroundService from '@voximplant/react-native-foreground-service';
import BackgroundTimer from 'react-native-background-timer';
import OpenApplication from 'react-native-open-application';

const StatusBarHeight = Platform.OS === 'ios' ? getStatusBarHeight(true) : StatusBar.currentHeight;

let locationSubscription = null;
let locationTimeout = null;

export default function Main( {navigation} ) {

    const dispatch = useDispatch();
    const isFocused = useIsFocused();
    const timerId = useRef(null);

    const joinData = useSelector(s => s.joinReducer);

    
    const userData = useSelector(s => s.usersReducer.mbData);
    const autologin = useSelector(s => s.usersReducer.autologin);
    const brightness = useSelector(s => s.usersReducer.brightness);
    const driverSetting = useSelector(s => s.usersReducer.driverSetting);

    const callLast = useSelector(s => s.usersReducer.callLast);

    const [exitApp, setexitApp] = useState(false);
    const [appState, setappState] = useState('active');

    const [brightnessState, setbrightnessState] = useState(brightness);

    useEffect(() => {
        if(userData){
            console.log('?????????????');
            startRecord();
        }
    }, [userData]);

    useEffect(() => {
        
        console.log("isFocused111", isFocused);
        if(isFocused) {
            //getGps();
            BackgroundTimer.stopBackgroundTimer();
            BackgroundTimer.runBackgroundTimer(() => { 
                callInterval();
                getbrightnessFunc();
            }, 1000);
        }
    }, [isFocused]);

    useEffect(() => {

        const appStateEvent = AppState.addEventListener('change', (state) => {
            setappState(state);
        });

        return () => {
            appStateEvent.remove();
        };

    }, []);

    useEffect(() => {
        console.log('state hook !!', appState);

        if(appState === 'active') {
            dispatch(reloadInfo());
        }

    }, [appState])

    useEffect(() => {
        
        console.log('exitApp', exitApp);

    }, [exitApp]);
    
    useEffect(() => {

        const backAction = () => {
            console.log('back 이벤트 !!', userData);
    
            if(!exitApp) {
                setexitApp(true);
                ToastAndroid.show(userData.option1 === '1' ? '한번 더 누르시면 운행 종료 처리 됩니다.' : '한번 더 누르시면 종료됩니다.', ToastAndroid.SHORT);
                timerId.current = setTimeout(
                    () => {
                        setexitApp(false);
                    },
                    2000    // 2초
                );
            } else {
                setexitApp(false);
                clearTimeout(timerId.current);

                if(userData.option1 === '1') {
                    logoutFunc();  // 운행 종료처리
                } else {
                    BackHandler.exitApp();  // 앱 종료
                }
                
            }
    
            return true;
        };
        
        if(isFocused && userData) {
            const backHandler = BackHandler.addEventListener(
                "hardwareBackPress",
                backAction
            );
        
            return () => backHandler.remove();
        }

    }, [isFocused, userData, exitApp]);

    
    const getbrightnessFunc = () => {
        // console.log(DeviceBrightness.setBrightnessLevel(br));
        SystemSetting.getBrightness().then((brightness)=>{
            //console.log('Current brightness is ' + brightness);
            setbrightnessState(brightness);
            dispatch(
                setData({
                    key: 'brightness',
                    value: brightness
                })
            )
        });

    }

    const setbrightnessFunc = async (br) => {
        // console.log(DeviceBrightness.setBrightnessLevel(br));
        await SystemSetting.setBrightnessForce(br).then((success)=>{
           
        });
    }

    const logoutFunc = () => {

        var sender = {
            idx: userData.idx,
            type: '4',
            data: '1'
        }

        APIS.postData('/driver/driverInfoUpdate.php', sender).then(({ data }) => {
            console.log(data);
            //dispatch( logOut() );
            Geolocation.stopObserving();
            BackgroundTimer.stopBackgroundTimer();

            setTimeout(() => {
                BackHandler.exitApp(); 
                // navigation.reset({
                //     index: 0,
                //     routes: [{name: routes.splash}],
                // });
                // navigation.reset({
                //     index: 0,
                //     routes: [{name: routes.login}],
                // });
            }, 100)

        }).catch((e) => {
            
        });
       
    }

    const stateFunc = () => {
        console.log(userData.status);

        statusChange(userData.idx, userData.status*1 === 1 ? 2 : 1, (state) => {
            dispatch(
                setData({
                    key: 'mbData',
                    value: {...userData, status: state}
                })
            )
        });

        
    }

    const callStateFunc = () => {
        
        statusChange(userData.idx, userData.status*1 !== 3 ? 3 : 1, (state) => {
            dispatch(
                setData({
                    key: 'mbData',
                    value: {...userData, status: state}
                })
            )
        });
    }

    const dirverCallFunc = (data) => {
        console.log('call', data.call.callstatus);
        /* 진행중인 콜 확인 */
        if(data.call.driver_idx === userData.idx && (data.call.callstatus === '2' || data.call.callstatus === '3')) {
            BackgroundTimer.stopBackgroundTimer();
            navigation.navigate(routes.call, {idx: data.call.idx});
        } else {
            if(callLast*1 !== data.call.idx*1) {
                console.log('진행중');
                dispatch(
                    setData({
                        key: 'call',
                        value: {...data.call_addr, idx: data.call.idx, calltype: data.call.calltype, callpopsec: data.callpopsec, onSubmit: () => { navigation.navigate(routes.call, {idx: data.call.idx}) } }
                    })
                );
                dispatch(
                    setData({
                        key: 'callLast',
                        value: data.call.idx
                    })
                )
            }
            
        }
        
    }


    
    // const getGps = () => {
        
    //     // Geolocation.stopObserving();

    //     Geolocation.watchPosition(
    //         (position) => {
    //             console.log("///////////////// ACTIVE GPS ////////////////////", driverSetting ? driverSetting.value : 3000);
    //             // console.log(Platform.OS);
    //             console.log(position.coords.latitude + "//" + position.coords.longitude);
    //             // console.log("//////////////////////////////////////");

    //             var sender = {
    //                 idx: userData.idx,
    //                 lat: position.coords.latitude,
    //                 lng: position.coords.longitude
    //             }
    //             console.log('sender', sender);

    //             APIS.postData('/driver/gpsUpdate.php', sender).then(({ data }) => {
    //                 console.log(data);
    //                 dispatch( 
    //                     gpsUpdate({   
    //                         'lat': position.coords.latitude,
    //                         'lng': position.coords.longitude,
    //                     })
    //                 );
    //             }).catch((e) => {
    //                 //console.log('gps error!!', e);
    //             });

    //             // dispatch( 
    //             //     gpsUpdate({   
    //             //         'lat': position.coords.latitude,
    //             //         'lng': position.coords.longitude,
    //             //     })
    //             // );
                
    //         },
    //         (error) => {
    //             // See error code charts below.
    //             console.log(error.code, error.message);
    //         },
    //         { enableHighAccuracy: true, interval: 5000, fastestInterval: 5000, distanceFilter: 0 }
    //     );
    // }

    const callInterval = () => {
        //console.log('콜 찾는중...');

        var sender = {
            idx: userData.idx,
        }
        //console.log('sender', sender);

        APIS.postData('/driver/driverCall.php', sender).then(({ data }) => {
            console.log('driverCall', data);
            
            if(data) {
                dirverCallFunc(data);
                var uridataschema = 'com.wadriver';
                OpenApplication.openApplication(uridataschema);

                if(data?.call?.callstatus === '2'){
                    console.log("??????????수락함 네비에서");
                    dispatch(
                      setData({
                          key: 'call',
                          value: false
                      })
                    );
                }
            }
            
        }).catch((e) => {
            //console.log('gps error!!', e);
        });

        
    }
    const startRecord = async () => {
        console.log("????!!!!!!!!!!", userData.idx);
        ReactNativeForegroundService.register();
        ReactNativeForegroundService.start({
            id: userData.idx*1,
            title: 'Wataxi',
            message: '오늘도 안전한 주행 되세요.',
        });
        ReactNativeForegroundService.add_task(
            () => {
                console.log('포그라운드 확인??');
                foregradeGpsUpdate();
            },
            {
                delay: 5000,
                onLoop: true,
                taskId: userData.idx*2,
                onError: e => console.log('Error logging:', e),
            },
        );
    };
    const foregradeGpsUpdate = () => {
        Geolocation.getCurrentPosition(
            (position) => {
                console.log("????????????????????", position);
                var sender = {
                    idx: userData.idx,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                }
                console.log('sender', sender);

                APIS.postData('/driver/gpsUpdate.php', sender).then(({ data }) => {
                    console.log('gps update?');
                    dispatch( 
                        gpsUpdate({   
                            'lat': position.coords.latitude,
                            'lng': position.coords.longitude,
                        })
                    );
                }).catch((e) => {
                    //console.log('gps error!!', e);
                });                        
            },
            (error) => {
              // See error code charts below.
                console.log(error.code, error.message);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
        );
    }

    const headerOpt = {
        leftIcon: '메뉴',
        leftIconPress: () => {
            dispatch(menuOpen());
        },
        rightIcon: '공지',
        rightIconPress: () => {
            dispatch(noticeOpen());
        },
    };

    return (
        <RootLayout header={headerOpt} white={false} navigation={navigation}>
            <View style={styles.root} >
                {/* <Button title={'Start'} onPress={onStart} /> */}
                <View style={styles.brightnessBox}>
                    <Svg asset={images.brightness} width={rootStyle.brightness.width} height={rootStyle.brightness.height}/>
                    <Slider
                        style={styles.brightnessSlider}
                        maximumValue={1}
                        minimumValue={0}
                        minimumTrackTintColor="#666"
                        maximumTrackTintColor="#222"
                        thumbTintColor="#ccc"
                        thumbStyle={{width: 50, height: 50}}
                        trackStyle={styles.track}
                        step={0.05}
                        value={brightnessState}
                        onValueChange={async (brightness) => {
                            await setbrightnessFunc(brightness);
                        }}
                        onSlidingComplete={(brightness) => {
                            setbrightnessState(brightness);
                            dispatch(
                                setData({
                                    key: 'brightness',
                                    value: brightness
                                })
                            )
                        }}
                    />
                </View>
                
                <View style={styles.main}>
                    <TouchableOpacity style={styles.mainTop} onPress={() => {userData.status*1 !== 3 ? stateFunc() : console.log()}}>
                        {/* <TouchableOpacity onPress={() => {dirverCallFunc()}}>
                            <BlackText style={{color: '#fff'}}>콜받기 테스트</BlackText>
                        </TouchableOpacity> */}

                        <BlackText style={[styles.mainText, {color: findJsonKey(consts.driverState, userData.status, 'cl')}]}>{findJson(consts.driverState, userData.status)}</BlackText>
                        <BlackText style={styles.mainSubText}>이 곳을 터치하면 빈차/주행 상태로 변경됩니다.</BlackText>
                    </TouchableOpacity>

                    <View style={styles.mainBottom}>
                        <ButtonGr
                            onPress={() =>  navigation.navigate(routes.waitingCall)}
                            style={styles.button}
                            type={2}    
                            label="대기콜 선택"
                        />
                        <ButtonGr
                            onPress={() => callStateFunc()}
                            style={styles.button}
                            type={2}
                            label={userData.status*1 !== 3 ? "콜 멈춤" : '콜 받기'}
                        />
                    </View>
                </View>

                <UnlockSlider
                    isLeftToRight={true} // set false to move slider Right to Left
                    onEndReached={() => {
                        //console.log('end');
                        logoutFunc()
                    }}
                    isOpacityChangeOnSlide={true}
                    containerStyle={styles.pushBottom}
                    thumbElement={
                        <Svg asset={images.push_arrow} width={rootStyle.push_arrow.width} height={rootStyle.push_arrow.height}/>
                    }
                >
                    <Text style={styles.pushBottomText}>밀어서 운행 종료</Text>
                </UnlockSlider>
            </View>
           
        </RootLayout>
    );
}

const styles = StyleSheet.create({
    root: {
        backgroundColor: "#333",
        height: '100%',
    },
    brightnessBox: {
        flexDirection: 'row',
        height: 60,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    brightnessSlider: {
        width: SCREENWIDTH - 72,
        marginLeft: -5,
    },
    main: {
        padding: 10,
        marginBottom: 10
    },
    mainTop: {
        backgroundColor: '#000',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        height: SCREENHEIGHT - 65 - 60 - 10 - 105 - 84 - StatusBarHeight ,
        position: 'relative'
    },
    mainText: {
        fontFamily: fonts.notoSansBold,
        fontSize: SCREENWIDTH * 0.25,
        lineHeight: SCREENWIDTH * 0.37,
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20
    },
    mainSubText: {
        fontFamily: fonts.notoSansMedium,
        fontSize: 16,
        lineHeight: 23,
        color: '#ccc',
        position: 'absolute',
        left: 0,
        bottom: 20,
        width: '100%',
        textAlign: 'center'
    },
    mainBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10
    },
    button: {
        width: (SCREENWIDTH - 30) / 2
    },
    pushBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        backgroundColor: '#222',
        height: 84,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10
    },
    pushBottomText: {
        fontFamily: fonts.notoSansMedium,
        fontSize: 32,
        lineHeight: 46,
        color: '#999',
        marginLeft: 64,
        textAlign: 'center',
    },








    logo: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 120,
        marginBottom: 20
    },
    toggle: {
        marginTop: 26,
        alignSelf: 'flex-end'
    },
    input: {
        marginBottom: 10
    },
});

  
