// src/config.js
import CONSTANTS from './constants.js';

const config = {
    // Example: 'https://<api-id>.execute-api.<region>.amazonaws.com/<stage>'
    apiBaseUrl: 'https://336sc7hnp5.execute-api.us-west-2.amazonaws.com/PRD',   // Hackathon
    displayedColumns: [
        CONSTANTS.KEYS.INBOUND_USER,
        CONSTANTS.KEYS.INBOUND_TIME,
        CONSTANTS.KEYS.SHELF_LOCATION,
        CONSTANTS.KEYS.ITEM_TYPE,
        CONSTANTS.KEYS.IS_VIOLATION,
        CONSTANTS.KEYS.VIOLATION_CONTENT
    ],
    chartColors: {
        categorical: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'],
        line: {
            inbound: '#ff9900',
            outbound: '#36a2eb',
            currentInventory: '#4CAF50'
        }
    },
    columnWidths: {
        [CONSTANTS.KEYS.INBOUND_USER]: "10%",
        [CONSTANTS.KEYS.INBOUND_TIME]: "20%",
        [CONSTANTS.KEYS.SHELF_LOCATION]: "15%",
        [CONSTANTS.KEYS.ITEM_TYPE]: "15%",
        [CONSTANTS.KEYS.IS_VIOLATION]: "10%",
        [CONSTANTS.KEYS.VIOLATION_CONTENT]: "30%"
    }
};

export default config;