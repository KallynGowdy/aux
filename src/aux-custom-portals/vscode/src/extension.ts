import * as vscode from 'vscode';
import { HostedSimulation } from '../../lib/HostedSimulation';
import { CasualOSFileSystemProvider } from './CasualOSFileSystemProvider';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activate!');

    const simulation = await initSimulation();

    console.log('Activated!');

    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider(
            'casualos',
            new CasualOSFileSystemProvider(simulation),
            {
                isCaseSensitive: true,
                isReadonly: true,
            }
        )
    );
}

function waitForInit(port: MessagePort) {
    return new Promise<MessagePort>((resolve, reject) => {
        port.onmessage = (message) => {
            if (message.data.type === 'init') {
                resolve(message.data.port);
            }
        };
    });
}

async function initPort(): Promise<MessagePort> {
    const channel = new MessageChannel();
    const promise = waitForInit(channel.port1);
    (<any>self).registerMessagePort('casualos', channel.port2);
    return await promise;
}

async function initSimulation() {
    const port = await initPort();
    const simulation = new HostedSimulation('casualos-vscode', port);
    await simulation.init();
    return simulation;
}
