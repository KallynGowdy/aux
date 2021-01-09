import { BatchingZoneSpec } from './BatchingZoneSpec';
import { waitAsync } from '../test/TestHelpers';
import { CleanupZoneSpec } from './CleanupZoneSpec';

console.warn = jest.fn();

describe('BatchingZoneSpec', () => {
    describe('timers', () => {
        let flush: jest.Mock<any>;
        let zone: Zone;
        let cleanup: CleanupZoneSpec;

        beforeEach(() => {
            jest.useFakeTimers('modern');
            Zone.assertZonePatched();

            flush = jest.fn();

            cleanup = new CleanupZoneSpec();
            let wrapper = Zone.current.fork(cleanup);

            zone = wrapper.fork(new BatchingZoneSpec(flush));
        });

        afterEach(() => {
            cleanup.unsubscribe();
            jest.useRealTimers();
        });

        it('should trigger the flush callback when a macro task finishes', () => {
            expect(Zone.current === zone).toBe(false);
            const task = jest.fn();
            const result = zone.run(() => {
                setTimeout(() => task(), 1000);
            });

            expect(flush).toBeCalledTimes(1);

            jest.advanceTimersByTime(1001);

            expect(task).toBeCalledTimes(1);
            expect(flush).toBeCalledTimes(2);
        });

        it('should trigger the flush callback when an interval task executes', () => {
            let interval: number | NodeJS.Timeout;
            const task = jest.fn();
            const result = zone.run(() => {
                interval = setInterval(() => task(), 1000);
            });

            expect(flush).toBeCalledTimes(1);

            jest.advanceTimersByTime(1001);

            expect(task).toBeCalledTimes(1);
            expect(flush).toBeCalledTimes(2);

            jest.advanceTimersByTime(1001);

            expect(task).toBeCalledTimes(2);
            expect(flush).toBeCalledTimes(3);

            if (interval) {
                zone.run(() => {
                    clearInterval(<any>interval);
                });
            }
        });
    });

    describe('promises', () => {
        let flush: jest.Mock<any>;
        let zone: Zone;
        let cleanup: CleanupZoneSpec;

        beforeEach(() => {
            Zone.assertZonePatched();

            flush = jest.fn();

            cleanup = new CleanupZoneSpec();
            let wrapper = Zone.root.fork(cleanup);

            zone = wrapper.fork(new BatchingZoneSpec(flush));
        });

        afterEach(() => {
            cleanup.unsubscribe();
        });

        it('should trigger the flush callback when running a synchronous task', () => {
            const result = zone.run(() => {
                return 1 + 2;
            });

            expect(result).toEqual(3);
            expect(flush).toBeCalledTimes(1);
        });

        it('should trigger the flush callback when a promise (micro task) is created', async () => {
            const task = jest.fn();
            const result = zone.run(() => {
                return Promise.resolve(0).then(task);
            });

            expect(task).not.toBeCalled();
            expect(flush).toBeCalledTimes(1);

            await waitAsync();

            expect(task).toBeCalledTimes(1);
            expect(flush).toBeCalledTimes(2);
        });

        it('should batch micro tasks together', async () => {
            const task1 = jest.fn();
            const task2 = jest.fn();
            const result = zone.run(() => {
                return Promise.resolve(0).then(task1).then(task2);
            });

            expect(flush).toBeCalledTimes(1);
            expect(task1).not.toBeCalled();
            expect(task2).not.toBeCalled();

            await waitAsync();

            expect(task1).toBeCalledTimes(1);
            expect(task2).toBeCalledTimes(1);
            expect(flush).toBeCalledTimes(3);
        });

        it('should support nested calls', () => {
            const result = zone.run(() => {
                return zone.run(() => {
                    return 1 + 2;
                });
            });

            expect(result).toEqual(3);
            expect(flush).toBeCalledTimes(1);
        });

        it('should support running in the zone while in flush', () => {
            const task1 = jest.fn();
            const task2 = jest.fn();
            flush.mockImplementation(() => {
                zone.run(task1);
                zone.run(task2);
            });

            const result = zone.run(() => {
                return 1 + 2;
            });

            expect(result).toEqual(3);
            expect(flush).toBeCalledTimes(1);
            expect(task1).toBeCalledTimes(1);
            expect(task2).toBeCalledTimes(1);
        });
    });
});
