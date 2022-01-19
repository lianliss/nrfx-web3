module.exports = miliseconds => {
    return new Promise(resolve => setTimeout(resolve, miliseconds));
};