import { AsyncSimulationWrapper } from '../managers/AsyncSimulationWrapper';
import { createProxyClient } from './WorkerProxyClient';

const worker: Worker = self as any;
const wrapper = new AsyncSimulationWrapper();
const sub = createProxyClient(worker, wrapper);
