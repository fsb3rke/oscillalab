import './style.css';
import { applyTheme } from './core/theme';
import { getLocale } from './core/i18n';
import { renderApp } from './ui/shell';
import './experiments/torsional-pendulum';
import './experiments/driven-spring-mass';
import './experiments/coupled-oscillators';

applyTheme();
document.documentElement.lang = getLocale();

const app = document.getElementById('app');
if (app) {
  renderApp(app);
}
