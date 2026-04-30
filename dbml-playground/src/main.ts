import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

import {
  createApp,
} from 'vue';
import {
  createPinia,
} from 'pinia';
import FloatingVue from 'floating-vue';
import App from './App.vue';
import './styles/main.css';
import 'floating-vue/dist/style.css';

self.MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};

const app = createApp(App);
app.use(createPinia());
app.use(FloatingVue);
app.mount('#app');
