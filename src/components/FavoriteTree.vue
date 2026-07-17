<template>
  <section class="favorite-tree workspace-tree">
    <div class="workspace-header" @click="togglePanel">
      <span>
        <i :class="state.ui.collapsed ? 'fa fa-caret-right' : 'fa fa-caret-down'"></i>
        <i class="fa fa-briefcase workspace-icon"></i>
        {{ $t('message.workspace') }}
      </span>
    </div>

    <div v-show="!state.ui.collapsed" class="workspace-content">
      <div class="favorite-header workspace-section-header" @click="toggleFavorites">
        <span>
          <i
            :class="state.ui.favoritesCollapsed
              ? 'fa fa-caret-right' : 'fa fa-caret-down'">
          </i>
          <i class="fa fa-star favorite-star"></i>
          {{ $t('message.favorites') }}
          <span class="favorite-count">({{ state.favorites.length }})</span>
        </span>
        <el-button
          class="favorite-add-group"
          type="text"
          icon="el-icon-circle-plus-outline"
          :title="$t('message.favorite_new_group')"
          @click.stop="newGroup(false)">
        </el-button>
      </div>

      <div v-show="!state.ui.favoritesCollapsed" class="favorite-groups">
        <div v-if="!state.favorites.length && !state.groups.length" class="favorite-empty">
          {{ $t('message.favorite_empty') }}
        </div>

        <div v-for="group in displayGroups" :key="group.id" class="favorite-group">
          <div class="favorite-group-header" @click="toggleGroup(group)">
            <span class="favorite-group-title" :title="group.name">
              <i :class="group.collapsed ? 'fa fa-caret-right' : 'fa fa-caret-down'"></i>
              <i class="fa fa-folder"></i>
              {{ group.name }}
              <span class="favorite-count">({{ favoritesInGroup(group.id).length }})</span>
            </span>

            <el-dropdown
              v-if="group.id !== ungroupedId"
              trigger="click"
              size="mini"
              @command="command => groupCommand(group, command)"
              @click.native.stop>
              <i class="el-icon-more favorite-action"></i>
              <el-dropdown-menu slot="dropdown">
                <el-dropdown-item command="rename">
                  {{ $t('message.favorite_rename') }}
                </el-dropdown-item>
                <el-dropdown-item command="up" :disabled="group.order === 0">
                  {{ $t('message.favorite_move_up') }}
                </el-dropdown-item>
                <el-dropdown-item
                  command="down"
                  :disabled="group.order === state.groups.length - 1">
                  {{ $t('message.favorite_move_down') }}
                </el-dropdown-item>
                <el-dropdown-item command="delete" divided>
                  {{ $t('el.upload.delete') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
          </div>

          <div v-show="!group.collapsed" class="favorite-items">
            <div
              v-for="favorite in favoritesInGroup(group.id)"
              :key="favorite.id"
              class="favorite-item"
              :class="{ 'is-unavailable': isUnavailable(favorite) }"
              :title="favoriteTitle(favorite)"
              @click="openFavorite(favorite)">
              <i class="fa fa-key"></i>
              <span class="favorite-item-title">{{ favorite.title }}</span>
              <span class="favorite-db">DB{{ favorite.db }}</span>
              <i v-if="isUnavailable(favorite)" class="el-icon-warning favorite-warning"></i>

              <el-dropdown
                trigger="click"
                size="mini"
                @command="command => favoriteCommand(favorite, command)"
                @click.native.stop>
                <i class="el-icon-more favorite-action"></i>
                <el-dropdown-menu slot="dropdown">
                  <el-dropdown-item command="open">{{ $t('message.open') }}</el-dropdown-item>
                  <el-dropdown-item command="edit">
                    {{ $t('message.favorite_edit') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="copy">
                    {{ $t('message.favorite_copy_key') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="remove" divided>
                    {{ $t('message.favorite_remove') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>

      <div class="workspace-section-header" @click="toggleRecent">
        <span>
          <i :class="state.ui.recentCollapsed ? 'fa fa-caret-right' : 'fa fa-caret-down'"></i>
          <i class="fa fa-history recent-icon"></i>
          {{ $t('message.recent_keys') }}
          <span class="favorite-count">({{ state.recentKeys.length }})</span>
        </span>
        <el-button
          v-if="state.recentKeys.length"
          class="favorite-add-group"
          type="text"
          icon="el-icon-delete"
          :title="$t('message.recent_clear')"
          @click.stop="clearRecentKeys">
        </el-button>
      </div>
      <div v-show="!state.ui.recentCollapsed" class="workspace-section-body">
        <div v-if="!state.recentKeys.length" class="favorite-empty workspace-empty">
          {{ $t('message.recent_empty') }}
        </div>
        <div
          v-for="recent in state.recentKeys"
          :key="recent.id"
          class="favorite-item workspace-entry"
          :class="{ 'is-unavailable': isUnavailable(recent) }"
          :title="storedKeyTitle(recent)"
          @click="openFavorite(recent)">
          <i class="fa fa-key"></i>
          <span class="favorite-item-title">{{ recent.title }}</span>
          <span class="favorite-db">DB{{ recent.db }}</span>
          <i v-if="isUnavailable(recent)" class="el-icon-warning favorite-warning"></i>
          <el-dropdown
            trigger="click"
            size="mini"
            @command="command => recentCommand(recent, command)"
            @click.native.stop>
            <i class="el-icon-more favorite-action"></i>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="open">{{ $t('message.open') }}</el-dropdown-item>
              <el-dropdown-item command="copy">
                {{ $t('message.favorite_copy_key') }}
              </el-dropdown-item>
              <el-dropdown-item command="remove" divided>
                {{ $t('el.upload.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </div>

      <div class="workspace-section-header" @click="toggleQueries">
        <span>
          <i :class="state.ui.queriesCollapsed ? 'fa fa-caret-right' : 'fa fa-caret-down'"></i>
          <i class="fa fa-search query-icon"></i>
          {{ $t('message.saved_queries') }}
          <span class="favorite-count">({{ state.savedQueries.length }})</span>
        </span>
      </div>
      <div v-show="!state.ui.queriesCollapsed" class="workspace-section-body">
        <div v-if="!state.savedQueries.length" class="favorite-empty workspace-empty">
          {{ $t('message.saved_query_empty') }}
        </div>
        <div
          v-for="query in state.savedQueries"
          :key="query.id"
          class="favorite-item workspace-entry"
          :class="{ 'is-unavailable': isUnavailable(query) }"
          :title="savedQueryTitle(query)"
          @click="openSavedQuery(query)">
          <i class="fa fa-search"></i>
          <span class="favorite-item-title">{{ query.name }}</span>
          <span class="favorite-db">DB{{ query.db }}</span>
          <i v-if="isUnavailable(query)" class="el-icon-warning favorite-warning"></i>
          <el-dropdown
            trigger="click"
            size="mini"
            @command="command => queryCommand(query, command)"
            @click.native.stop>
            <i class="el-icon-more favorite-action"></i>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="open">{{ $t('message.open') }}</el-dropdown-item>
              <el-dropdown-item command="rename">
                {{ $t('message.favorite_rename') }}
              </el-dropdown-item>
              <el-dropdown-item command="remove" divided>
                {{ $t('el.upload.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </div>
    </div>

    <el-dialog
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      width="420px"
      append-to-body>
      <el-form label-width="90px" @submit.native.prevent>
        <el-form-item :label="$t('message.favorite_title')">
          <el-input
            ref="titleInput"
            v-model="favoriteForm.title"
            @keyup.enter.native="saveFavorite">
          </el-input>
        </el-form-item>
        <el-form-item :label="$t('message.favorite_group')">
          <div class="favorite-group-select">
            <el-select v-model="favoriteForm.groupId">
              <el-option
                :label="$t('message.favorite_ungrouped')"
                :value="ungroupedId">
              </el-option>
              <el-option
                v-for="group in state.groups"
                :key="group.id"
                :label="group.name"
                :value="group.id">
              </el-option>
            </el-select>
            <el-button
              type="text"
              icon="el-icon-circle-plus-outline"
              @click="newGroup(true)">
              {{ $t('message.favorite_new_group') }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="dialogVisible = false">
          {{ $t('el.messagebox.cancel') }}
        </el-button>
        <el-button type="primary" @click="saveFavorite">
          {{ $t('el.messagebox.confirm') }}
        </el-button>
      </span>
    </el-dialog>
  </section>
</template>

<script>
// Electron is provided by the desktop runtime rather than the renderer bundle.
// eslint-disable-next-line import/no-extraneous-dependencies
import { clipboard } from 'electron';
import favoriteStore from '../favoriteStore';
import storage from '../storage';

export default {
  data() {
    return {
      state: favoriteStore.state,
      ungroupedId: favoriteStore.UNGROUPED_ID,
      dialogVisible: false,
      dialogMode: 'add',
      pendingFavorite: null,
      favoriteForm: {
        title: '',
        groupId: favoriteStore.UNGROUPED_ID,
      },
      connectionIds: new Set(),
    };
  },
  computed: {
    dialogTitle() {
      const key = this.dialogMode === 'add' ? 'favorite_add' : 'favorite_edit';
      return this.$t(`message.${key}`);
    },
    displayGroups() {
      const ungrouped = {
        id: this.ungroupedId,
        name: this.$t('message.favorite_ungrouped'),
        order: -1,
        collapsed: !!this.state.ui.ungroupedCollapsed,
      };
      return [ungrouped].concat(this.state.groups.slice().sort((a, b) => a.order - b.order));
    },
  },
  created() {
    this.refreshConnectionIds();
    this.$bus.$on('showAddFavoriteDialog', this.showAddFavoriteDialog);
    this.$bus.$on('showSaveQueryDialog', this.showSaveQueryDialog);
    this.$bus.$on('refreshConnections', this.refreshConnectionIds);
    this.$bus.$on('favoriteKeyRenamed', this.syncRenamedKey);
  },
  mounted() {
    if (favoriteStore.consumeLoadError()) {
      this.$message.warning(this.$t('message.favorite_storage_recovered'));
    }
  },
  beforeDestroy() {
    this.$bus.$off('showAddFavoriteDialog', this.showAddFavoriteDialog);
    this.$bus.$off('showSaveQueryDialog', this.showSaveQueryDialog);
    this.$bus.$off('refreshConnections', this.refreshConnectionIds);
    this.$bus.$off('favoriteKeyRenamed', this.syncRenamedKey);
  },
  methods: {
    errorMessage(error) {
      const knownErrors = [
        'favorite_group_name_required',
        'favorite_group_exists',
        'favorite_title_required',
        'saved_query_name_required',
      ];
      return knownErrors.includes(error.message) ? this.$t(`message.${error.message}`) : error.message;
    },
    refreshConnectionIds() {
      this.connectionIds = new Set(Object.keys(storage.getConnections()));
    },
    favoritesInGroup(groupId) {
      return this.state.favorites.filter(item => item.groupId === groupId)
        .sort((a, b) => a.order - b.order);
    },
    togglePanel() {
      favoriteStore.setPanelCollapsed(!this.state.ui.collapsed);
    },
    toggleFavorites() {
      favoriteStore.setFavoritesCollapsed(!this.state.ui.favoritesCollapsed);
    },
    toggleRecent() {
      favoriteStore.setRecentCollapsed(!this.state.ui.recentCollapsed);
    },
    toggleQueries() {
      favoriteStore.setQueriesCollapsed(!this.state.ui.queriesCollapsed);
    },
    toggleGroup(group) {
      favoriteStore.setGroupCollapsed(group.id, !group.collapsed);
    },
    newGroup(selectAfterCreate = false) {
      this.$prompt(this.$t('message.favorite_group_name'), this.$t('message.favorite_new_group'), {
        inputValue: '',
        inputValidator: value => (
          value && value.trim() ? true : this.$t('message.favorite_group_name_required')
        ),
      }).then(({ value }) => {
        try {
          const group = favoriteStore.addGroup(value);
          if (selectAfterCreate) {
            this.favoriteForm.groupId = group.id;
          }
        } catch (e) {
          this.$message.error(this.errorMessage(e));
        }
      }).catch(() => {});
    },
    groupCommand(group, command) {
      if (command === 'rename') {
        this.$prompt(this.$t('message.favorite_group_name'), this.$t('message.favorite_rename'), {
          inputValue: group.name,
          inputValidator: value => (
            value && value.trim() ? true : this.$t('message.favorite_group_name_required')
          ),
        }).then(({ value }) => {
          try {
            favoriteStore.renameGroup(group.id, value);
          } catch (e) {
            this.$message.error(this.errorMessage(e));
          }
        }).catch(() => {});
      } else if (command === 'delete') {
        this.$confirm(this.$t('message.favorite_delete_group_tip'), { type: 'warning' })
          .then(() => favoriteStore.deleteGroup(group.id)).catch(() => {});
      } else if (command === 'up') {
        favoriteStore.moveGroup(group.id, -1);
      } else if (command === 'down') {
        favoriteStore.moveGroup(group.id, 1);
      }
    },
    showAddFavoriteDialog(payload) {
      const existing = favoriteStore.findFavorite(payload.connectionId, payload.db, payload.key);
      if (existing) {
        this.$message.warning(this.$t('message.favorite_already_exists'));
        return;
      }
      this.dialogMode = 'add';
      this.pendingFavorite = payload;
      this.favoriteForm = {
        title: this.$util.bufToString(payload.key) || this.$t('message.favorite_empty_key'),
        groupId: this.ungroupedId,
      };
      this.dialogVisible = true;
      this.$nextTick(() => this.$refs.titleInput && this.$refs.titleInput.focus());
    },
    showSaveQueryDialog(payload) {
      const existing = favoriteStore.findSavedQuery(
        payload.connectionId, payload.db, payload.pattern, payload.exact,
      );
      if (existing) {
        this.$message.warning(this.$t('message.saved_query_exists'));
        return;
      }
      this.$prompt(this.$t('message.saved_query_name'), this.$t('message.save_query'), {
        inputValue: payload.pattern,
        inputValidator: value => (
          value && value.trim() ? true : this.$t('message.saved_query_name_required')
        ),
      }).then(({ value }) => {
        try {
          const result = favoriteStore.addSavedQuery({ ...payload, name: value });
          if (result.created) {
            this.$message.success(this.$t('message.saved_query_added'));
          } else {
            this.$message.warning(this.$t('message.saved_query_exists'));
          }
        } catch (e) {
          this.$message.error(this.errorMessage(e));
        }
      }).catch(() => {});
    },
    editFavorite(favorite) {
      this.dialogMode = 'edit';
      this.pendingFavorite = favorite;
      this.favoriteForm = {
        title: favorite.title,
        groupId: favorite.groupId,
      };
      this.dialogVisible = true;
      this.$nextTick(() => this.$refs.titleInput && this.$refs.titleInput.focus());
    },
    saveFavorite() {
      try {
        if (this.dialogMode === 'add') {
          const result = favoriteStore.addFavorite({
            ...this.pendingFavorite,
            title: this.favoriteForm.title,
            groupId: this.favoriteForm.groupId,
          });
          if (!result.created) {
            this.$message.warning(this.$t('message.favorite_already_exists'));
          } else {
            this.$message.success(this.$t('message.favorite_added'));
          }
        } else {
          favoriteStore.updateTitle(this.pendingFavorite.id, this.favoriteForm.title);
          favoriteStore.moveFavorite(this.pendingFavorite.id, this.favoriteForm.groupId);
        }
        this.dialogVisible = false;
      } catch (e) {
        this.$message.error(this.errorMessage(e));
      }
    },
    favoriteCommand(favorite, command) {
      if (command === 'open') {
        this.openFavorite(favorite);
      } else if (command === 'edit') {
        this.editFavorite(favorite);
      } else if (command === 'copy') {
        const key = Buffer.from(favorite.keyBase64, 'base64');
        clipboard.writeText(this.$util.bufToString(key));
      } else if (command === 'remove') {
        favoriteStore.removeFavorite(favorite.id);
      }
    },
    openFavorite(favorite) {
      this.$emit('open', favorite);
    },
    recentCommand(recent, command) {
      if (command === 'open') {
        this.openFavorite(recent);
      } else if (command === 'copy') {
        clipboard.writeText(this.$util.bufToString(Buffer.from(recent.keyBase64, 'base64')));
      } else if (command === 'remove') {
        favoriteStore.removeRecentKey(recent.id);
      }
    },
    clearRecentKeys() {
      this.$confirm(this.$t('message.recent_clear_tip'), { type: 'warning' })
        .then(() => favoriteStore.clearRecentKeys()).catch(() => {});
    },
    openSavedQuery(query) {
      this.$emit('open-query', query);
    },
    queryCommand(query, command) {
      if (command === 'open') {
        this.openSavedQuery(query);
      } else if (command === 'rename') {
        this.$prompt(this.$t('message.saved_query_name'), this.$t('message.favorite_rename'), {
          inputValue: query.name,
          inputValidator: value => (
            value && value.trim() ? true : this.$t('message.saved_query_name_required')
          ),
        }).then(({ value }) => {
          try {
            favoriteStore.renameSavedQuery(query.id, value);
          } catch (e) {
            this.$message.error(this.errorMessage(e));
          }
        }).catch(() => {});
      } else if (command === 'remove') {
        favoriteStore.removeSavedQuery(query.id);
      }
    },
    isUnavailable(favorite) {
      return !this.connectionIds.has(favorite.connectionId)
        || !!this.state.unavailable[favorite.id];
    },
    favoriteTitle(favorite) {
      return this.storedKeyTitle(favorite);
    },
    storedKeyTitle(item) {
      const key = this.$util.bufToString(Buffer.from(item.keyBase64, 'base64'));
      return `${key} | DB${item.db}`;
    },
    savedQueryTitle(query) {
      const mode = query.exact ? this.$t('message.exact_search') : this.$t('message.pattern_search');
      return `${query.pattern} | DB${query.db} | ${mode}`;
    },
    syncRenamedKey(connectionId, db, oldKey, newKey) {
      favoriteStore.syncRenamedKey(connectionId, db, oldKey, newKey);
    },
  },
};
</script>

<style>
.favorite-tree {
  margin: 8px 8px 0 0;
  border: 1px solid #e4e0e0;
  border-radius: 4px;
  flex: 0 1 auto;
  max-height: 48vh;
  overflow: hidden;
  color: #292f31;
}
.dark-mode .favorite-tree {
  border-color: #52636c;
  color: #f7f7f7;
}
.workspace-header,
.favorite-header,
.workspace-section-header,
.favorite-group-header,
.favorite-item {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.workspace-header {
  min-height: 32px;
  padding: 0 8px;
  background: #f5f7fa;
  font-weight: 600;
}
.workspace-header,
.workspace-section-header,
.favorite-header {
  justify-content: space-between;
}
.dark-mode .workspace-header {
  background: #34454d;
}
.workspace-icon {
  color: #409eff;
  margin: 0 4px;
}
.workspace-content {
  max-height: calc(48vh - 34px);
  overflow-y: auto;
}
.workspace-section-header {
  min-height: 30px;
  padding: 0 6px 0 24px;
  font-size: 13px;
  border-top: 1px solid #ebeef5;
}
.favorite-header {
  background: #fafafa;
  font-weight: 600;
  border-top: 0;
}
.dark-mode .favorite-header {
  background: #2e3c43;
}
.workspace-section-header > span > .fa {
  width: 15px;
  margin-right: 5px;
}
.dark-mode .workspace-section-header {
  border-top-color: #52636c;
}
.favorite-star {
  color: #e6a23c;
  margin: 0 3px;
}
.favorite-add-group {
  padding: 4px;
}
.favorite-groups {
  overflow: visible;
  margin-left: 24px;
  border-left: 1px solid #dcdfe6;
}
.workspace-section-body {
  margin-left: 24px;
  border-left: 1px solid #dcdfe6;
}
.dark-mode .favorite-groups,
.dark-mode .workspace-section-body {
  border-left-color: #52636c;
}
.favorite-empty {
  padding: 14px 8px;
  color: #909399;
  text-align: center;
  font-size: 13px;
}
.favorite-group-header {
  min-height: 27px;
  padding: 0 6px 0 12px;
  background: #fafafa;
}
.dark-mode .favorite-group-header {
  background: #2e3c43;
}
.favorite-group-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.favorite-group-title .fa-folder {
  color: #848a90;
  margin: 0 4px;
}
.favorite-count,
.favorite-db {
  color: #909399;
  font-size: 11px;
}
.favorite-item {
  height: 26px;
  padding: 0 5px 0 32px;
  font-size: 13px;
}
.workspace-entry {
  padding-left: 16px;
}
.workspace-empty {
  padding-left: 16px;
  text-align: left;
}
.favorite-item:hover {
  background: #e7ebec;
}
.dark-mode .favorite-item:hover {
  background: #50616b;
}
.favorite-item > .fa-key {
  color: #909399;
  margin-right: 5px;
}
.favorite-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.favorite-db {
  margin-left: 4px;
}
.favorite-action {
  padding: 5px;
  color: #909399;
}
.favorite-warning {
  color: #e6a23c;
  margin-left: 4px;
}
.favorite-item.is-unavailable .favorite-item-title {
  color: #909399;
  text-decoration: line-through;
}
.favorite-group-select {
  display: flex;
  gap: 8px;
}
.favorite-group-select .el-select {
  flex: 1;
}
</style>
