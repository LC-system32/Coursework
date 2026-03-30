const { createApp } = Vue;

const CONFIG_KEY = 'data-import-popup-config';

createApp({
  data() {
    return {
      sourceSite: '',
      targetSite: '',
      fieldMappings: [],
      statusMessage: ''
    };
  },

  async mounted() {
    await this.loadSettings();
  },

  methods: {
    async loadSettings() {
      try {
        const result = await chrome.storage.local.get(CONFIG_KEY);
        const config = result[CONFIG_KEY] || {};

        this.sourceSite = config.sourceSite || '';
        this.targetSite = config.targetSite || '';
        this.fieldMappings = Array.isArray(config.fieldMappings)
          ? config.fieldMappings
          : [];
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        this.statusMessage = 'Не удалось загрузить настройки.';
      }
    },

    addMapping() {
      this.fieldMappings.push({
        source: '',
        target: ''
      });
    },

    removeMapping(index) {
      this.fieldMappings.splice(index, 1);
    },

    async saveSettings() {
      try {
        const config = {
          sourceSite: this.sourceSite.trim(),
          targetSite: this.targetSite.trim(),
          fieldMappings: this.fieldMappings.map(item => ({
            source: (item.source || '').trim(),
            target: (item.target || '').trim()
          }))
        };

        await chrome.storage.local.set({
          [CONFIG_KEY]: config
        });

        this.statusMessage = 'Настройки сохранены.';
      } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        this.statusMessage = 'Не удалось сохранить настройки.';
      }
    },

    async resetSettings() {
      try {
        this.sourceSite = '';
        this.targetSite = '';
        this.fieldMappings = [];

        await chrome.storage.local.set({
          [CONFIG_KEY]: {
            sourceSite: '',
            targetSite: '',
            fieldMappings: []
          }
        });

        this.statusMessage = 'Настройки сброшены.';
      } catch (error) {
        console.error('Ошибка сброса настроек:', error);
        this.statusMessage = 'Не удалось сбросить настройки.';
      }
    }
  }
}).mount('#app');