
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

class TransfersLockedError extends Error {
    name = 'error_transfersLocked';
    message = 'Current transfer is still in progress';
}

class MasterAccountEmptyError extends Error {
    name = 'error_masterAccountError';
    message = 'Exchanger account ran out of funds';
}

module.exports = {
    NoGasError,
    WrongTokenError,
    FiatNotFoundError,
    NotEnoughBalanceError,
    NoWalletsError,
    TransfersLockedError,
    MasterAccountEmptyError,
};