// Actions.js

export const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
    // New Actions for File Management
    ADD_FILE: 'add-file',
    RENAME_FILE: 'rename-file',
    DELETE_FILE: 'delete-file',
    // New Action for Code History
    SAVE_SNAPSHOT: 'save-snapshot', 
    REVERT_HISTORY: 'revert-history', 
};

// NOTE: If you are using module.exports (CommonJS) in a Node.js environment 
// (like your backend) but using import/export in React, this structure works best.
// If you must use CommonJS (module.exports) in Actions.js, you must use a
// different import syntax in EditorPage.js (see next section).