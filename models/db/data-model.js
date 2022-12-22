const logger = require('../../utils/logger');

// An example data for DataModel constructor. An "id" number field will be added by default
const exampleModel = {
    userID: { // Data key. Will be used as a parameter name when outputting from the database
        field: 'user_id', // DataBase field name. (optional) The Data key is used by default.
        type: 'number', // Data type. (optional) Default: "string".
    },
    address: { // There is the field name will be the same: "address".
        type: 'string', // Default type
    },
    privateData: {
        field: 'private_data',
        type: 'json', // For objects storing
    },
    isGenerated: {
        field: 'is_generated',
        type: 'boolean', // Uses TINYINT(1) as a boolean value
    },
};

/**
 * MYSQL data model
 * Handles incoming and outgoing data.
 * Allowed data types: "number", "string", "json", "boolean".
 */
class DataModel {
    constructor(model) {
        this.model = {};
        this.fields = {};
        const fullModel = {
            id: { // Default field. Can be overridden
                type: 'number',
            },
            ...model,
        };
        Object.keys(fullModel).map(key => {
            const field = fullModel[key].field || key;
            this.model[key] = {
                key,
                field,
                ...fullModel[key],
            };
            this.fields[field] = this.model[key];
        });
    }

    /**
     * Process DB request result
     * @param response
     * @returns {Array} - rows of objects
     */
    process = response => {
        const result = [];
        if (!response) return result;
        return response.map(row => {
            const rowResult = {};
            Object.keys(row).map(field => {
                const value = row[field];
                const fieldModel = this.fields[field];
                if (fieldModel) {
                    switch (fieldModel.type) {
                        case 'number':
                            rowResult[fieldModel.key] = Number(value);
                            break;
                        case 'boolean':
                            rowResult[fieldModel.key] = !!value;
                            break;
                        case 'json':
                        case 'string':
                        default:
                            rowResult[fieldModel.key] = value;
                    }
                } else {
                    rowResult[field] = value;
                }
            });
            return rowResult;
        })
    };

    /**
     * Prepare an object to use its data in a query
     * @param data {object}
     * @returns {object} - Object with DB fields as keys and escaped data as values
     */
    encode = data => {
        const encoded = {};
        Object.keys(data).map(key => {
            const value = data[key];
            // Current property model
            const model = this.model[key];
            if (!model) {
                logger.warn('[DataModel][encodeData] Unknown property', key);
                return;
            }
            switch (model.type) {
                case 'number':
                    encoded[model.field] = value;
                    return;
                case 'boolean':
                    encoded[model.field] = value ? 1 : 0;
                    return;
                case 'json':
                    encoded[model.field] = `'${JSON.stringify(value)}'`;
                    return;
                case 'string':
                default:
                    encoded[model.field] = `'${value}'`;
            }
        });
        return encoded;
    };

    /**
     * Returns a strings for using in a query
     * fields property example: "(user_id, address)",
     * values property example: "(4279, '0xa4FF4DBb11F...')",
     * update property example: "user_id=4279, address='0xa4FF4DBb...'"
     * @param data {object} - example: {userID: 4279, address: '0xa4FF4DBb...'}
     * @returns {{fields: string, values: string, update: string, and: string}}
     */
    getRequestParts = data => {
        const fields = [];
        const values = [];
        const update = [];
        const encoded = this.encode(data);
        Object.keys(encoded).map(field => {
            const value = encoded[field];
            fields.push(field);
            values.push(value);
            update.push(`${field}=${value}`);
        });
        if (fields.length) {
            return {
                fields: `(${fields.join(', ')})`,
                values: `(${values.join(', ')})`,
                update: update.join(",\n"),
                and: update.join("\nAND "),
            }
        }

    }
}

module.exports = DataModel;
