// Import AWS SDK and the functions under test
import AWS from 'aws-sdk';
import { updateEnduranceSeason, updateAggregateSkillsSeason, updatePositions } from '../index.mjs'; 

// Rewriting Mock setup for AWS SDK based on the learned approach
jest.mock('aws-sdk', () => {
  const promiseMock = jest.fn();
  const updateMock = jest.fn().mockReturnThis(); // Enable method chaining by returning 'this'
  const getMock = jest.fn().mockReturnThis(); // Similarly for get
  const scanMock = jest.fn().mockReturnThis(); // And for scan
  
  // Setup the promise method to be part of the chain
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        update: updateMock,
        get: getMock,
        scan: scanMock,
        promise: promiseMock,
      })),
    },
    // Expose the mocks so they can be accessed in tests for assertions and setup
    promiseMock,
    updateMock,
    getMock,
    scanMock,
  };
});

// Helper to reset and setup mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Setup default resolved value for promise mocks to simulate DynamoDB responses
  AWS.promiseMock.mockResolvedValue({ Attributes: { updated: true } }); // Adjust based on expected DynamoDB response for update
  AWS.promiseMock.mockResolvedValue({ Item: { endurance_season: 50, strength_season: 50 } }); // For get
  AWS.promiseMock.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined }); // For scan
});

describe('updateEnduranceSeason', () => {
  it('successfully updates user score', async () => {
    const tableName = 'leaderboard';
    const userId = 'user123';
    const pointsEarned = 50;

    await updateEnduranceSeason(tableName, userId, pointsEarned);

    // Assert that the update method was called with correct parameters
    expect(AWS.updateMock).toHaveBeenCalledWith({
      TableName: tableName,
      Key: { 'user_id': userId },
      UpdateExpression: 'SET endurance_season = endurance_season + :pointsEarned',
      ExpressionAttributeValues: { ':pointsEarned': pointsEarned },
      ReturnValues: 'UPDATED_NEW',
    });

    // Ensure the promise method was called to execute the operation
    expect(AWS.promiseMock).toHaveBeenCalled();
  });
});
