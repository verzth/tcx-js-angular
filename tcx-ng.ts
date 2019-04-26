import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import * as crypt from 'crypto-js';
import * as moment from 'moment';

@Injectable()
export class TCX{
    public static $_COOKIE_NAME = '_tcx_token';
    options: TCXOption = {
        url : '',
        app_id : '',
        secret_key : '',
        public_key : '',
        auth : 'param',
        master_key : ''
    } as TCXOption;
    constructor(private http: HttpClient) {}

    init(options: TCXOption){
        this.options = Object.assign(this.options,options);
    }

    static random(): string {
        let text = '';
        const possible = 'abcdefghijklmnopqrstuvwxyz0123456789';

        for (let i = 0; i < 16; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        return text;
    }

    static getTime(): string {
        return moment().format('YYYYMMDDHHmmss');
    };

    getCookie(): object {
        let x = document.cookie.split(";");
        let val:any = false;
        x.forEach(function (y,i) {
            while (y.charAt(0) == " ")y = y.substring(1,y.length);
            let t = y.split("=");
            if(TCX.$_COOKIE_NAME === t[0]){
                val=t[1];
            }
        });
        if(!val){
            this.setCookie({});
            val = crypt.AES.encrypt(JSON.stringify({}),crypt.enc.Base64.stringify(crypt.enc.Utf8.parse("tcx-js")));
        }
        return JSON.parse(crypt.AES.decrypt(val,crypt.enc.Base64.stringify(crypt.enc.Utf8.parse("tcx-js"))).toString(crypt.enc.Utf8));
    }
    setCookie(cookie) {
        let date: Date = new Date();
        date.setFullYear(date.getFullYear()+3);
        document.cookie = TCX.$_COOKIE_NAME+"="+crypt.AES.encrypt(JSON.stringify(cookie),crypt.enc.Base64.stringify(crypt.enc.Utf8.parse("tcx-js")))+";expires="+date.toUTCString()+";path=/";
    }

    getAppID(): string {
        return this.options.app_id;
    };

    getAppPass(params: object): string {
        let paramText = '', clientKey = TCX.random();
        switch (this.options.auth) {
            case 'param':{
                Object.keys(params).sort().forEach(function (i,d) {
                    console.log(i);
                    paramText+=i+'='+d+'&';
                });
                paramText.replace(/^&+|&+$/g, '');
            }break;
            case 'time':{
                paramText+=params.tcx_datetime;
            }break;
        }
        let auth = crypt.enc.Hex.stringify(crypt.SHA1(paramText+this.options.public_key+clientKey));
        auth = crypt.enc.Utf8.parse(auth+':'+clientKey);
        auth = crypt.enc.Base64.stringify(auth);
        return auth;
    };

    getToken(): Observable<any> {
        return new Observable((observable)=>{
            if(this.getCookie().token===undefined) {
                let cr;
                if(this.options.auth==='time'){
                    let time = TCX.getTime();
                    cr = {
                        app_id: this.getAppID(),
                        app_pass: this.getAppPass({tcx_datetime: time}),
                        tcx_datetime: time
                    };
                }else{
                    cr = {
                        app_id: this.getAppID(),
                        app_pass: this.getAppPass({})
                    };
                }
                this.http.post<any>(
                    this.options.url + '/tcx/authorize',
                    cr
                ).subscribe((res)=>{
                    if (res.status === 1) {
                        this.setCookie(res.data);
                        observable.next(res.data.token);
                    } else {
                        observable.next(false);
                    }
                },(res)=>{
                    observable.next(false);
                });
            }else{
                observable.next(this.getCookie().token);
            }
        });
    };
    refreshToken(): Observable<any> {
        return new Observable<any>((observable)=>{
            if(this.getCookie().token===undefined) {
                this.getToken().subscribe((res)=>{
                    observable.next(res);
                });
            }else{
                if(this.getCookie().refresh){
                    this.http.post<any>(
                        this.options.url + '/tcx/reauthorize',
                        {
                            app_id: this.getAppID(),
                            token: this.getCookie().refresh
                        }
                    ).subscribe((res)=>{
                        if (res.status === 1) {
                            this.setCookie(res.data);
                            observable.next(res.data.token);
                        } else {
                            observable.next(false);
                        }
                    },(res)=>{
                        observable.next(false);
                    });
                }else observable.next(this.getCookie().token);
            }
        });
    };
    clearToken() {
        this.setCookie({});
    };

    getMasterToken(): string {
        var token = crypt.enc.Utf8.parse(this.options.master_key);
        return crypt.enc.Base64.stringify(token);
    };

    appendTime(params: object): object {
        params['tcx_datetime'] = TCX.getTime();
        return params;
    };
}

export interface TCXOption {
    url : string;
    app_id : string;
    secret_key : string;
    public_key : string;
    auth : string;
    master_key : string;
}
