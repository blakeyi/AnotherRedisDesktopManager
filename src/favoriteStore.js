import Vue from 'vue';
import storage from './storage';
import util from './util';

const UNGROUPED_ID = 'ungrouped';

const state = Vue.observable({
  version: 1,
  ui: {
    collapsed: false,
    favoritesCollapsed: false,
    ungroupedCollapsed: false,
    recentCollapsed: false,
    queriesCollapsed: false,
  },
  groups: [],
  favorites: [],
  recentKeys: [],
  savedQueries: [],
  unavailable: {},
});

let initialized = false;

function cloneData() {
  return JSON.parse(JSON.stringify({
    version: state.version,
    ui: state.ui,
    groups: state.groups,
    favorites: state.favorites,
    recentKeys: state.recentKeys,
    savedQueries: state.savedQueries,
  }));
}

function replaceState(data) {
  state.version = data.version;
  state.ui = data.ui;
  state.groups.splice(0, state.groups.length, ...data.groups);
  state.favorites.splice(0, state.favorites.length, ...data.favorites);
  state.recentKeys.splice(0, state.recentKeys.length, ...data.recentKeys);
  state.savedQueries.splice(0, state.savedQueries.length, ...data.savedQueries);
}

function commit(data) {
  storage.saveFavorites(data);
  replaceState(data);
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${util.randomString(5)}`;
}

function keyBase64(key) {
  return Buffer.isBuffer(key) ? key.toString('base64') : key;
}

function identity(connectionId, db, key) {
  return `${connectionId}\u0000${parseInt(db, 10)}\u0000${keyBase64(key)}`;
}

function normalizeFavoriteOrder(data, groupId) {
  const orderedIds = data.favorites.filter(item => item.groupId === groupId)
    .sort((a, b) => a.order - b.order)
    .map(item => item.id);
  const normalized = data.favorites.map(item => (
    item.groupId === groupId
      ? { ...item, order: orderedIds.indexOf(item.id) }
      : item
  ));
  data.favorites.splice(0, data.favorites.length, ...normalized);
}

const favoriteStore = {
  state,
  UNGROUPED_ID,
  init() {
    if (!initialized) {
      replaceState(storage.getFavorites());
      initialized = true;
    }
    return state;
  },
  consumeLoadError() {
    return storage.consumeFavoritesLoadError();
  },
  findFavorite(connectionId, db, key) {
    const target = identity(connectionId, db, key);
    return state.favorites.find(item => (
      identity(item.connectionId, item.db, item.keyBase64) === target
    ));
  },
  addGroup(name) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('favorite_group_name_required');
    }
    if (state.groups.some(group => group.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('favorite_group_exists');
    }

    const data = cloneData();
    const group = {
      id: createId('group'),
      name: trimmed,
      order: data.groups.length,
      collapsed: false,
      createdAt: Date.now(),
    };
    data.groups.push(group);
    commit(data);
    return group;
  },
  renameGroup(groupId, name) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('favorite_group_name_required');
    }
    if (state.groups.some(group => (
      group.id !== groupId && group.name.toLowerCase() === trimmed.toLowerCase()
    ))) {
      throw new Error('favorite_group_exists');
    }

    const data = cloneData();
    const group = data.groups.find(item => item.id === groupId);
    if (!group) {
      return false;
    }
    group.name = trimmed;
    commit(data);
    return true;
  },
  deleteGroup(groupId) {
    const data = cloneData();
    const index = data.groups.findIndex(group => group.id === groupId);
    if (index < 0) {
      return false;
    }

    data.groups.splice(index, 1);
    data.groups = data.groups.map((group, order) => ({ ...group, order }));
    let ungroupedOrder = data.favorites.filter(item => (
      item.groupId === UNGROUPED_ID
    )).length;
    data.favorites = data.favorites.map((favorite) => {
      if (favorite.groupId !== groupId) {
        return favorite;
      }
      const moved = {
        ...favorite,
        groupId: UNGROUPED_ID,
        order: ungroupedOrder,
      };
      ungroupedOrder += 1;
      return moved;
    });
    normalizeFavoriteOrder(data, UNGROUPED_ID);
    commit(data);
    return true;
  },
  moveGroup(groupId, offset) {
    const data = cloneData();
    const oldIndex = data.groups.findIndex(group => group.id === groupId);
    const newIndex = oldIndex + offset;
    if (oldIndex < 0 || newIndex < 0 || newIndex >= data.groups.length) {
      return false;
    }
    const group = data.groups.splice(oldIndex, 1)[0];
    data.groups.splice(newIndex, 0, group);
    data.groups = data.groups.map((item, index) => ({ ...item, order: index }));
    commit(data);
    return true;
  },
  setPanelCollapsed(collapsed) {
    const data = cloneData();
    data.ui.collapsed = !!collapsed;
    commit(data);
  },
  setFavoritesCollapsed(collapsed) {
    const data = cloneData();
    data.ui.favoritesCollapsed = !!collapsed;
    commit(data);
  },
  setRecentCollapsed(collapsed) {
    const data = cloneData();
    data.ui.recentCollapsed = !!collapsed;
    commit(data);
  },
  setQueriesCollapsed(collapsed) {
    const data = cloneData();
    data.ui.queriesCollapsed = !!collapsed;
    commit(data);
  },
  setGroupCollapsed(groupId, collapsed) {
    if (groupId === UNGROUPED_ID) {
      const data = cloneData();
      data.ui.ungroupedCollapsed = !!collapsed;
      commit(data);
      return;
    }
    const data = cloneData();
    const group = data.groups.find(item => item.id === groupId);
    if (group) {
      group.collapsed = !!collapsed;
      commit(data);
    }
  },
  addFavorite(payload) {
    const existing = this.findFavorite(payload.connectionId, payload.db, payload.key);
    if (existing) {
      return { favorite: existing, created: false };
    }

    const title = payload.title.trim();
    if (!title) {
      throw new Error('favorite_title_required');
    }
    const groupId = state.groups.some(group => group.id === payload.groupId)
      ? payload.groupId : UNGROUPED_ID;
    const data = cloneData();
    const favorite = {
      id: createId('favorite'),
      groupId,
      connectionId: payload.connectionId,
      db: parseInt(payload.db, 10),
      keyBase64: keyBase64(payload.key),
      title,
      order: data.favorites.filter(item => item.groupId === groupId).length,
      createdAt: Date.now(),
    };
    data.favorites.push(favorite);
    commit(data);
    return { favorite, created: true };
  },
  updateTitle(favoriteId, title) {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error('favorite_title_required');
    }
    const data = cloneData();
    const favorite = data.favorites.find(item => item.id === favoriteId);
    if (!favorite) {
      return false;
    }
    favorite.title = trimmed;
    commit(data);
    return true;
  },
  moveFavorite(favoriteId, groupId) {
    const targetGroupId = state.groups.some(group => group.id === groupId)
      ? groupId : UNGROUPED_ID;
    const data = cloneData();
    const favorite = data.favorites.find(item => item.id === favoriteId);
    if (!favorite || favorite.groupId === targetGroupId) {
      return false;
    }
    const oldGroupId = favorite.groupId;
    favorite.groupId = targetGroupId;
    favorite.order = data.favorites.filter(item => (
      item.groupId === targetGroupId && item.id !== favoriteId
    )).length;
    normalizeFavoriteOrder(data, oldGroupId);
    normalizeFavoriteOrder(data, targetGroupId);
    commit(data);
    return true;
  },
  removeFavorite(favoriteId) {
    const data = cloneData();
    const index = data.favorites.findIndex(item => item.id === favoriteId);
    if (index < 0) {
      return false;
    }
    const { groupId } = data.favorites[index];
    data.favorites.splice(index, 1);
    normalizeFavoriteOrder(data, groupId);
    commit(data);
    Vue.delete(state.unavailable, favoriteId);
    return true;
  },
  recordRecentKey(payload) {
    const encodedKey = keyBase64(payload.key);
    const target = identity(payload.connectionId, payload.db, encodedKey);
    const data = cloneData();
    const existingIndex = data.recentKeys.findIndex(item => (
      identity(item.connectionId, item.db, item.keyBase64) === target
    ));
    const existing = existingIndex >= 0 ? data.recentKeys.splice(existingIndex, 1)[0] : null;
    const recent = {
      id: existing ? existing.id : createId('recent'),
      connectionId: payload.connectionId,
      db: parseInt(payload.db, 10),
      keyBase64: encodedKey,
      title: payload.title || '',
      lastOpenedAt: Date.now(),
    };
    data.recentKeys.unshift(recent);
    data.recentKeys = data.recentKeys.slice(0, 30);
    commit(data);
    return recent;
  },
  removeRecentKey(recentId) {
    const data = cloneData();
    const index = data.recentKeys.findIndex(item => item.id === recentId);
    if (index < 0) {
      return false;
    }
    data.recentKeys.splice(index, 1);
    commit(data);
    Vue.delete(state.unavailable, recentId);
    return true;
  },
  clearRecentKeys() {
    const data = cloneData();
    data.recentKeys = [];
    commit(data);
  },
  findSavedQuery(connectionId, db, pattern, exact) {
    return state.savedQueries.find(query => (
      query.connectionId === connectionId && query.db === parseInt(db, 10)
      && query.pattern === pattern && query.exact === !!exact
    ));
  },
  addSavedQuery(payload) {
    const name = payload.name.trim();
    if (!name) {
      throw new Error('saved_query_name_required');
    }
    const existing = this.findSavedQuery(
      payload.connectionId, payload.db, payload.pattern, payload.exact,
    );
    if (existing) {
      return { query: existing, created: false };
    }
    const data = cloneData();
    const query = {
      id: createId('query'),
      name,
      connectionId: payload.connectionId,
      db: parseInt(payload.db, 10),
      pattern: payload.pattern,
      exact: !!payload.exact,
      createdAt: Date.now(),
      lastUsedAt: 0,
    };
    data.savedQueries.push(query);
    commit(data);
    return { query, created: true };
  },
  renameSavedQuery(queryId, name) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('saved_query_name_required');
    }
    const data = cloneData();
    const query = data.savedQueries.find(item => item.id === queryId);
    if (!query) {
      return false;
    }
    query.name = trimmed;
    commit(data);
    return true;
  },
  removeSavedQuery(queryId) {
    const data = cloneData();
    const index = data.savedQueries.findIndex(item => item.id === queryId);
    if (index < 0) {
      return false;
    }
    data.savedQueries.splice(index, 1);
    commit(data);
    Vue.delete(state.unavailable, queryId);
    return true;
  },
  touchSavedQuery(queryId) {
    const data = cloneData();
    const query = data.savedQueries.find(item => item.id === queryId);
    if (!query) {
      return false;
    }
    query.lastUsedAt = Date.now();
    commit(data);
    return true;
  },
  syncRenamedKey(connectionId, db, oldKey, newKey) {
    const source = this.findFavorite(connectionId, db, oldKey);
    if (!source) {
      return false;
    }
    const destination = this.findFavorite(connectionId, db, newKey);
    const data = cloneData();
    if (destination && destination.id !== source.id) {
      const destinationIndex = data.favorites.findIndex(item => item.id === destination.id);
      data.favorites.splice(destinationIndex, 1);
    }
    const favorite = data.favorites.find(item => item.id === source.id);
    favorite.keyBase64 = keyBase64(newKey);
    normalizeFavoriteOrder(data, favorite.groupId);
    if (destination && destination.groupId !== favorite.groupId) {
      normalizeFavoriteOrder(data, destination.groupId);
    }
    commit(data);
    if (destination) {
      Vue.delete(state.unavailable, destination.id);
    }
    Vue.delete(state.unavailable, source.id);
    return true;
  },
  markUnavailable(favoriteId, reason) {
    Vue.set(state.unavailable, favoriteId, reason || true);
  },
  clearUnavailable(favoriteId) {
    Vue.delete(state.unavailable, favoriteId);
  },
};

favoriteStore.init();

export default favoriteStore;
