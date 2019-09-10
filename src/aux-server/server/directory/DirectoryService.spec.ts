import { DirectoryService, isInternal, getSubHost } from './DirectoryService';
import { DirectoryStore } from './DirectoryStore';
import { MemoryDirectoryStore } from './MemoryDirectoryStore';
import { DirectoryEntry } from './DirectoryEntry';
import { DirectoryUpdate } from './DirectoryUpdate';

const dateNowMock = (Date.now = jest.fn());

describe('DirectoryService', () => {
    let service: DirectoryService;
    let store: DirectoryStore;

    beforeEach(() => {
        store = new MemoryDirectoryStore();
        service = new DirectoryService(store);
    });

    describe('update()', () => {
        it('should add the entry to the store', async () => {
            const entry: DirectoryUpdate = {
                key: 'abc',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '1.1.1.1',
                publicName: 'Test',
                password: 'password',
            };

            dateNowMock.mockReturnValue(123);
            await service.update(entry);

            const stored = await store.findByHash('abc');
            expect(stored).toEqual({
                hash: 'abc',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '1.1.1.1',
                publicName: 'Test',
                lastUpdateTime: 123,
                passwordHash: expect.any(String),
            });
        });

        it('should update the last update time', async () => {
            const entry: DirectoryUpdate = {
                key: 'abc',
                password: 'test',
                privateIpAddress: '192.168.1.1',
                publicIpAddress: '87.54.145.1',
                publicName: 'Test',
            };

            dateNowMock.mockReturnValue(999);
            await service.update(entry);

            const stored = await store.findByHash('abc');
            expect(stored.lastUpdateTime).toBe(999);
        });

        it('should return a not authorized result if the password is wrong', async () => {
            dateNowMock.mockReturnValue(999);

            await service.update({
                key: 'abc',
                password: 'test',
                privateIpAddress: '192.168.1.1',
                publicIpAddress: '87.54.145.1',
                publicName: 'Test',
            });

            const entry: DirectoryUpdate = {
                key: 'abc',
                password: 'wrong',
                privateIpAddress: '192.168.1.1',
                publicIpAddress: '87.54.145.1',
                publicName: 'Test 2',
            };

            expect(await service.update(entry)).toEqual({
                type: 'not_authorized',
            });
        });
    });

    describe('findEntries()', () => {
        beforeEach(async () => {
            await store.update({
                key: 'abc 1',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '87.54.145.1',
                passwordHash: '',
                lastUpdateTime: 123,
                publicName: 'Z Test',
            });
            await store.update({
                key: 'abc 2',
                publicIpAddress: '192.168.1.2',
                privateIpAddress: '87.54.145.1',
                passwordHash: '',
                lastUpdateTime: 123,
                publicName: 'Test 2',
            });
            await store.update({
                key: 'abc 3',
                publicIpAddress: '10.0.0.1',
                privateIpAddress: '87.54.145.1',
                passwordHash: '',
                lastUpdateTime: 123,
                publicName: 'Test 3',
            });
            await store.update({
                key: 'abc 4',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '87.54.145.1',
                passwordHash: '',
                lastUpdateTime: 123,
                publicName: 'Test 4',
            });
        });

        it('should return all the entries that match the given IP Address ordered by name', async () => {
            const result = await service.findEntries('192.168.1.1');

            expect(result).toEqual({
                type: 'query_results',
                entries: [
                    {
                        publicName: 'Test 4',
                        subhost: 'internal.abc 4',
                    },
                    {
                        publicName: 'Z Test',
                        subhost: 'internal.abc 1',
                    },
                ],
            });
        });
    });

    describe('isInternal()', () => {
        const cases = [
            [
                true,
                'IP address matches the entry IP',
                '192.168.1.1',
                '192.168.1.1',
            ],
            [
                false,
                'IP address does not match the entry IP',
                '192.168.1.1',
                '192.168.1.2',
            ],
        ];

        it.each(cases)(
            'should return %s if the given %s',
            (expected, desc, entryIp, givenIp) => {
                const result = isInternal(
                    {
                        key: 'abc',
                        publicName: 'Test',
                        passwordHash: '',
                        lastUpdateTime: 456,
                        privateIpAddress: '192.168.1.1',
                        publicIpAddress: entryIp,
                    },
                    givenIp
                );

                expect(result).toBe(expected);
            }
        );
    });

    describe('getSubHost()', () => {
        it('should prefix a 0 to the hash if the IP is internal', () => {
            const result = getSubHost(
                {
                    key: 'abc',
                    publicName: 'Test',
                    passwordHash: '',
                    lastUpdateTime: 456,
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                },
                '192.168.1.1'
            );

            expect(result).toBe('internal.abc');
        });

        it('should prefix a 1 to the hash if the IP is not internal', () => {
            const result = getSubHost(
                {
                    key: 'abc',
                    publicName: 'Test',
                    passwordHash: '',
                    lastUpdateTime: 456,
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                },
                '192.168.1.2'
            );

            expect(result).toBe('external.abc');
        });
    });
});
