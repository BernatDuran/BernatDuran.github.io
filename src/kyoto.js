import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { cities } from './data/cities.js';
import { kyotoPlaces } from './data/kyoto.js';
import { initCityPage } from './city.js';

initCityPage(cities.kyoto, kyotoPlaces);
