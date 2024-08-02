import connector from '../../../src/connector';

describe('@dbml/core - mysql connector', () => {
  test('mysql connector', async () => {
    const connectionString = 'mysql://root:root@localhost:3306/online_auction_app';

    const res = await connector.fetchSchema(connectionString, 'mysql');

    expect(res).toBe('');
  });
});
