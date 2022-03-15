
class NoGasError extends Error {
    name = 'error_noGas';
    message = 'Insufficient funds for gas';
}

class PermissionDeniedError extends Error {
    name = 'error_permissionDenied';
    message = 'Permission denied';
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

class NotNarfexWalletError extends Error {
    name = 'error_notNarfexWallet';
    message = 'Your wallet is not known to our service';
}

class BonusReceivedError extends Error {
    name = 'error_bonusAlreadyReceived';
    message = 'Your bonus has already been received';
}

class NoBonusError extends Error {
    name = 'error_noBonus';
    message = 'Your have no bonus for your refer';
}

class MissingParametersError extends Error {
    name = 'error_missingParameters';
    message = 'Missing parameters';
}

module.exports = {
    NoGasError,
    WrongTokenError,
    FiatNotFoundError,
    NotEnoughBalanceError,
    NoWalletsError,
    TransfersLockedError,
    MasterAccountEmptyError,
    NotNarfexWalletError,
    BonusReceivedError,
    NoBonusError,
    PermissionDeniedError,
    MissingParametersError,
};
