/**
 * Get a symbol to USDT from the pair
 * @param pair
 * @returns symbol {string} - symbol or null
 */
module.exports = pair => {
    const split = pair.split('USDT');
    if (split[1] !== undefined && !split[1].length) {  // If have USDT at the end only
        return split[0];
    } else {
        return null;
    }
};