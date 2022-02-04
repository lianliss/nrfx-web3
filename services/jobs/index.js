const _ = require('lodash');
const logger = require('../../utils/logger');

const DEFAULT_DELAY = 1000 * 60;
const INTERVAL_FAILS_COUNT = 5;
const DEFAULT_JOB_NAME = 'Default job name';
const DEFAULT_CONFIG = {
    name: DEFAULT_JOB_NAME,
    delay: DEFAULT_DELAY,
    action: () => {},
    maxFailsCount: INTERVAL_FAILS_COUNT,
};

class Job {
    constructor(config = {}) {
        Object.assign(this, DEFAULT_CONFIG, config);
        this.run();
    }

    interval = null;
    failsCount = 0;
    delay = DEFAULT_DELAY;
    name = DEFAULT_JOB_NAME;
    maxFailsCount = INTERVAL_FAILS_COUNT;

    executeAction = async () => {
        try {
            let action = this.action();
            if (!!action.then) {
                // It action is a Promise lets wait for it
                action = await action;
            }
            logger.info('[Job]', this.name, 'executed', action);
        } catch (error) {
            const isLastFail = ++this.failsCount >= this.maxFailsCount;
            const loggerMethod = isLastFail
                ? logger.error
                : logger.warn;
            loggerMethod('[Job]', this.name, 'Fail', this.failsCount, error);
            // Clear this job
            if (isLastFail) {
                this.stop();
            }
        }
    };

    run = () => {
        // Run action first
        this.executeAction();
        // Run actions loop with interval
        this.interval = setInterval(this.executeAction.bind(this), this.delay);
    };

    stop = () => {
        clearInterval(this.interval);
        logger.warn('[Job]', this.name, 'Stopped');
    }
}

const bankCardsReservationsJob = new Job(require('./cards-reservations'));

module.exports = {
    Job,
    bankCardsReservationsJob,
};
