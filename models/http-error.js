class HttpError extends Error {
    constructor(message, errorCode) {
        super(message); // add "message"-property to Error-class
        this.code = errorCode //adds "code"-property to HttpError class
    }
}

module.exports = HttpError