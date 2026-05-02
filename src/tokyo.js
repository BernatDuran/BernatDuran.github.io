import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { cities } from './data/cities.js';
import { tokyoPlaces } from './data/tokyo.js';
import { initCityPage } from './city.js';

initCityPage(cities.tokyo, tokyoPlaces);
