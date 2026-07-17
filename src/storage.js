import utils from './util';

const { randomString } = utils;

const EMPTY_FAVORITES = () => ({
  version: 1,
  ui: { collapsed: false, ungroupedCollapsed: false },
  groups: [],
  favorites: [],
});

const validBase64 = value => (
  value === ''
  || (/^[A-Za-z0-9+/]+={0,2}$/.test(value)
    && value.length % 4 === 0
    && Buffer.from(value, 'base64').toString('base64') === value)
);

export default {
  favoritesLoadError: false,
  favoritesBackupError: null,
  getSetting(key) {
    let settings = localStorage.getItem('settings');
    settings = settings ? JSON.parse(settings) : {};

    return key ? settings[key] : settings;
  },
  saveSettings(settings) {
    settings = JSON.stringify(settings);
    return localStorage.setItem('settings', settings);
  },
  getFontFamily() {
    let fontFamily = this.getSetting('fontFamily');

    // set to default font-family
    if (
      !fontFamily || !fontFamily.length
      || fontFamily.toString() === 'Default Initial'
    ) {
      fontFamily = ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica',
        'Arial', 'sans-serif', 'Microsoft YaHei', 'Apple Color Emoji', 'Segoe UI Emoji'];
    }

    return fontFamily.map(line => `"${line}"`).join(',');
  },
  getCustomFormatter(name = '') {
    let formatters = localStorage.getItem('customFormatters');
    formatters = formatters ? JSON.parse(formatters) : [];

    if (!name) {
      return formatters;
    }

    for (const line of formatters) {
      if (line.name === name) {
        return line;
      }
    }
  },
  saveCustomFormatters(formatters = []) {
    return localStorage.setItem('customFormatters', JSON.stringify(formatters));
  },
  getFavorites() {
    const raw = localStorage.getItem('favorites');

    if (!raw) {
      return EMPTY_FAVORITES();
    }

    try {
      const data = JSON.parse(raw);

      if (!data || data.version !== 1 || !Array.isArray(data.groups)
        || !Array.isArray(data.favorites)) {
        throw new Error('Invalid favorites schema');
      }

      const groups = data.groups.filter(group => (
        group && typeof group.id === 'string' && group.id
        && group.id !== 'ungrouped'
        && typeof group.name === 'string' && group.name.trim()
      )).map((group, index) => ({
        id: group.id,
        name: group.name.trim(),
        order: Number.isFinite(group.order) ? group.order : index,
        collapsed: !!group.collapsed,
        createdAt: Number.isFinite(group.createdAt) ? group.createdAt : Date.now(),
      }));
      const groupIds = new Set(groups.map(group => group.id));
      const identities = new Set();
      const favorites = [];

      data.favorites.forEach((favorite, index) => {
        if (!favorite || typeof favorite.id !== 'string' || !favorite.id
          || typeof favorite.connectionId !== 'string' || !favorite.connectionId
          || !Number.isInteger(favorite.db) || favorite.db < 0
          || typeof favorite.keyBase64 !== 'string' || !validBase64(favorite.keyBase64)
          || typeof favorite.title !== 'string' || !favorite.title.trim()) {
          return;
        }

        const identity = `${favorite.connectionId}\u0000${favorite.db}\u0000${favorite.keyBase64}`;
        if (identities.has(identity)) {
          return;
        }
        identities.add(identity);

        favorites.push({
          id: favorite.id,
          groupId: groupIds.has(favorite.groupId) ? favorite.groupId : 'ungrouped',
          connectionId: favorite.connectionId,
          db: favorite.db,
          keyBase64: favorite.keyBase64,
          title: favorite.title.trim(),
          order: Number.isFinite(favorite.order) ? favorite.order : index,
          createdAt: Number.isFinite(favorite.createdAt) ? favorite.createdAt : Date.now(),
        });
      });

      groups.sort((a, b) => a.order - b.order);
      const normalizedGroups = groups.map((group, index) => ({
        ...group,
        order: index,
      }));

      return {
        version: 1,
        ui: {
          collapsed: !!(data.ui && data.ui.collapsed),
          ungroupedCollapsed: !!(data.ui && data.ui.ungroupedCollapsed),
        },
        groups: normalizedGroups,
        favorites,
      };
    } catch (e) {
      const backupKey = `favorites_corrupt_${Date.now()}`;
      this.favoritesLoadError = true;
      try {
        localStorage.setItem(backupKey, raw);
        localStorage.removeItem('favorites');
      } catch (backupError) {
        this.favoritesBackupError = backupError;
      }
      return EMPTY_FAVORITES();
    }
  },
  saveFavorites(favorites) {
    return localStorage.setItem('favorites', JSON.stringify(favorites));
  },
  consumeFavoritesLoadError() {
    const hasError = this.favoritesLoadError;
    this.favoritesLoadError = false;
    return hasError;
  },
  addConnection(connection) {
    this.editConnectionByKey(connection, '');
  },
  getConnections(returnList = false) {
    let connections = localStorage.connections || '{}';

    connections = JSON.parse(connections);

    if (returnList) {
      connections = Object.keys(connections).map(key => connections[key]);
      this.sortConnections(connections);
    }

    return connections;
  },
  editConnectionByKey(connection, oldKey = '') {
    oldKey = connection.key || oldKey;

    const connections = this.getConnections();
    delete connections[oldKey];

    this.updateConnectionName(connection, connections);
    const newKey = this.getConnectionKey(connection, true);
    connection.key = newKey;

    // new added has no order, add it. do not add when edit mode
    if (!oldKey && isNaN(connection.order)) {
      // connection.order = Object.keys(connections).length;
      const maxOrder = Math.max(...Object.values(connections).map(item => (!isNaN(item.order) ? item.order : 0)));
      connection.order = (maxOrder > 0 ? maxOrder : 0) + 1;
    }

    connections[newKey] = connection;
    this.setConnections(connections);
  },
  editConnectionItem(connection, items = {}) {
    const key = this.getConnectionKey(connection);
    const connections = this.getConnections();

    if (!connections[key]) {
      return;
    }

    Object.assign(connection, items);
    Object.assign(connections[key], items);
    this.setConnections(connections);
  },
  updateConnectionName(connection, connections) {
    let name = this.getConnectionName(connection);

    for (const key in connections) {
      // if 'name' same with others, add random suffix
      if (this.getConnectionName(connections[key]) == name) {
        name += ` (${randomString(3)})`;
        break;
      }
    }

    connection.name = name;
  },
  getConnectionName(connection) {
    return connection.name || `${connection.host}@${connection.port}`;
  },
  setConnections(connections) {
    localStorage.connections = JSON.stringify(connections);
  },
  deleteConnection(connection) {
    const connections = this.getConnections();
    const key = this.getConnectionKey(connection);

    delete connections[key];

    this.hookAfterDelConnection(connection);
    this.setConnections(connections);
  },
  getConnectionKey(connection, forceUnique = false) {
    if (Object.keys(connection).length === 0) {
      return '';
    }

    if (connection.key) {
      return connection.key;
    }

    if (forceUnique) {
      return `${new Date().getTime()}_${randomString(5)}`;
    }

    return connection.host + connection.port + connection.name;
  },
  sortConnections(connections) {
    connections.sort((a, b) => {
      // drag ordered
      if (!isNaN(a.order) && !isNaN(b.order)) {
        return parseInt(a.order) <= parseInt(b.order) ? -1 : 1;
      }

      // no ordered, by key
      if (a.key && b.key) {
        return a.key < b.key ? -1 : 1;
      }

      return a.key ? 1 : (b.key ? -1 : 0);
    });
  },
  reOrderAndStore(connections = []) {
    const newConnections = {};

    for (const index in connections) {
      const connection = connections[index];
      connection.order = parseInt(index);
      newConnections[this.getConnectionKey(connection, true)] = connection;
    }

    this.setConnections(newConnections);

    return newConnections;
  },
  getStorageKeyMap(type) {
    const typeMap = {
      cli_tip: 'cliTips',
      last_db: 'lastSelectedDb',
      custom_db: 'customDbName',
      search_tip: 'searchTips',
    };

    return type ? typeMap[type] : typeMap;
  },
  initStorageKey(prefix, connectionName) {
    return `${prefix}_${connectionName}`;
  },
  getStorageKeyByName(type = 'cli_tip', connectionName = '') {
    return this.initStorageKey(this.getStorageKeyMap(type), connectionName);
  },
  hookAfterDelConnection(connection) {
    const connectionName = this.getConnectionName(connection);
    const types = Object.keys(this.getStorageKeyMap());

    const willRemovedKeys = [];

    for (const type of types) {
      willRemovedKeys.push(this.getStorageKeyByName(type, connectionName));
    }

    willRemovedKeys.forEach(k => localStorage.removeItem(k));
  },
};
