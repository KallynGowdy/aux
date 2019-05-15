import { setupAPI } from '../jailed/JailClient';
import { Application } from 'jailed';
import { JailedHostAPI } from '../jailed/JailHostAPI';
import { JailedClientAPI } from '../jailed/JailClientAPI';
import { AsyncSimulationWrapper } from './AsyncSimulationWrapper';

declare var application: Application<JailedHostAPI, JailedClientAPI>;

const wrapper = new AsyncSimulationWrapper();

setupAPI(application, wrapper);
