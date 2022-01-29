
class NoGasError extends Error {
    name = 'error_noGas';
    message = 'Insufficient funds for gas';
}

class WrongTokenError extends Error {
    name = 'error_wrongToken';
    message = 'Wrong token';
}

class FiatNotFoundError extends Error {
    name = 'error_fiatNotFound';
    message = 'Fiat not found';
}

class NotEnoughBalanceError extends Error {
    name = 'error_notEnoughBalance';
    message = 'Not enough balance';
}

class NoWalletsError extends Error {
    name = 'error_noWallets';
    message = 'User have no wallets';
}

module.exports = {
    NoGasError,
    WrongTokenError,
    FiatNotFoundError,
    NotEnoughBalanceError,
    NoWalletsError,
};
