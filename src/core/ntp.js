import NtpTimeSync from 'ntp-time-sync';
import console from './console';

let ntp         = NtpTimeSync.getInstance();
ntp.offset      = 0;
ntp.initialized = false;

ntp.initialize = () => {
    return ntp.getTime().then(function(result) {
        console.log('current system time', new Date());
        console.log('real time', result.now);
        console.log('offset in milliseconds', result.offset);
        ntp.offset      = result.offset;
        ntp.initialized = true;
    });
};

ntp.now = function() {
    let timeNow = new Date();
    timeNow.setUTCMilliseconds(timeNow.getUTCMilliseconds() + ntp.offset);
    return timeNow.getTime();
};

export default ntp;
