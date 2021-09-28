import config from "../config/config";

class Logger {
    log(msg) {
        config.DEBUG && console.log(msg);
    }
}

const logger = new Logger();
export default logger;