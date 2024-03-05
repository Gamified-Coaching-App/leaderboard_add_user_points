import AWS from 'aws-sdk';

const documentClient = new AWS.DynamoDB.DocumentClient();

export async function handler(event) {
    const { userId, pointsEarned } = JSON.parse(event.body);
    const tableName = 'leaderboard';

    try {
        await updateEnduranceSeason(tableName, userId, pointsEarned);
        console.log("Endurance season updated successfully for userId:", userId);

        await updateAggregateSkillsSeason(tableName, userId);
        console.log("Aggregate skills season updated successfully for userId:", userId);

        const entries = await fetchAllLeaderboardEntriesBucket(userId);
        console.log(`Fetched ${entries.length} entries for userId:`, userId);

        const updatedEntries = await updatePositions(entries);
        console.log("Positions updated successfully for", updatedEntries.length, "users.");
    } catch (error) {
        console.error("Error in handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to update leaderboard due to error: " + error.message }),
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Leaderboard updated successfully." }),
    };
}


export async function updateEnduranceSeason(tableName, userId, pointsEarned) {
    await documentClient.update({
        TableName: tableName,
        Key: { 'user_id': userId },
        UpdateExpression: 'SET endurance_season = endurance_season + :pointsEarned',
        ExpressionAttributeValues: { ':pointsEarned': pointsEarned },
        ReturnValues: 'UPDATED_NEW',
    }).promise();
}

async function updateAggregateSkillsSeason(tableName, userId) {
    const result = await documentClient.get({
        TableName: tableName,
        Key: { 'user_id': userId },
        ProjectionExpression: 'endurance_season, strength_season',
    }).promise();

    if (result.Item) {
        const { endurance_season, strength_season } = result.Item;
        const aggregate_skills_season = (endurance_season + strength_season);

        await documentClient.update({
            TableName: tableName,
            Key: { 'user_id': userId },
            UpdateExpression: 'SET aggregate_skills_season = :aggregate',
            ExpressionAttributeValues: { ':aggregate': aggregate_skills_season },
            ReturnValues: 'UPDATED_NEW',
        }).promise();
    } else {
        console.error('User not found for updating aggregate skills season');
        throw new Error('User not found');
    }
}

export async function fetchAllLeaderboardEntriesBucket(user_id) {
    // get user_id's bucket_id
    const userParams = {
        TableName: "leaderboard",
        Key: {
            "user_id": user_id
        }
    };

    const userData = await documentClient.get(userParams).promise(); // Changed dynamoDb to documentClient

    const bucket_id = userData.Item.bucket_id;

    // retrieve relevant data from leaderboard
    const params = {
        TableName: "leaderboard",
        FilterExpression: "bucket_id = :bucket_id",
        ExpressionAttributeValues: {
            ":bucket_id": bucket_id
        }
    };
    const entries = [];
    let items;
    do {
        items = await documentClient.scan(params).promise(); // Changed dynamoDb to documentClient
        entries.push(...items.Items);
        params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (items.LastEvaluatedKey);
    
    return entries;
}


export async function updatePositions(entries) {
    const sortedEntries = entries.sort((a, b) => b.aggregate_skills_season - a.aggregate_skills_season);
    const updates = [];

    for (let i = 0; i < sortedEntries.length; i++) {
        const newPosition = i + 1;
        if (sortedEntries[i].position_new !== newPosition) {
            const updateParams = {
                TableName: "leaderboard",
                Key: { "user_id": sortedEntries[i].user_id },
                // do not track the old positions
                // UpdateExpression: "set position_old = if_not_exists(position_new, :pos), position_new = :newPos",
                UpdateExpression: "set position_new = :newPos",
                ExpressionAttributeValues: {
                    ":pos": newPosition, // default if position_new doesn't exist
                    ":newPos": newPosition,
                },
                ConditionExpression: "attribute_exists(user_id)" // Ensure item exists
            };

            updates.push(documentClient.update(updateParams).promise().catch(error => console.error('Update failed for user:', sortedEntries[i].user_id, error)));
        }
    }

    await Promise.all(updates);
    return updates.map((_, index) => sortedEntries[index].user_id); // return updated user IDs
}
