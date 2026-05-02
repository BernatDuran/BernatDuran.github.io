import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { cities } from './data/cities.js';
import { osakaPlaces } from './data/osaka.js';
import { initCityPage } from './city.js';

initCityPage(cities.osaka, osakaPlaces);
