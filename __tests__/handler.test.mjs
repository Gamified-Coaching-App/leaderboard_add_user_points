// Import necessary modules and functions for testing
import AWS from 'aws-sdk';
import { handler } from '../index.mjs'; // Ensure the path is correct

jest.mock('aws-sdk', () => {
  // Mock the update method
  const mockUpdate = jest.fn(() => ({ promise: () => Promise.resolve({ Attributes: { updated: true } }) }));
  // Mock the get method
  const mockGet = jest.fn(() => ({ promise: () => Promise.resolve({ Item: { endurance_season: 50, strength_season: 50, bucket_id: 'bucket123' } }) }));
  // Mock the scan method
  const mockScan = jest.fn(() => ({ promise: () => Promise.resolve({ Items: [], LastEvaluatedKey: undefined }) }));
  
  // Simulate the global dynamoDb with the same mocked behavior as documentClient
  global.dynamoDb = {
    update: mockUpdate,
    get: mockGet,
    scan: mockScan,
  };

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        update: mockUpdate,
        get: mockGet,
        scan: mockScan,
      })),
    },
  };
});

describe('handler function', () => {
  it('successfully updates user points and positions', async () => {
    const event = {
      body: JSON.stringify({
        userId: 'user1',
        pointsEarned: 100,
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body).message).toEqual('Leaderboard updated successfully.');
  });

  afterEach(() => {
    // Reset the mocks after each test if necessary
    global.dynamoDb.update.mockClear();
    global.dynamoDb.get.mockClear();
    global.dynamoDb.scan.mockClear();
  });
});
