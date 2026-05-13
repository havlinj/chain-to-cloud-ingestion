import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

import type { VotingEvent } from "../domain/events.js";

export type EventPublisher = {
  publish(event: VotingEvent): Promise<void>;
};

export function createSnsPublisher(topicArn: string, client?: SNSClient): EventPublisher {
  const sns = client ?? new SNSClient({});

  return {
    async publish(event: VotingEvent) {
      const command = new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(event),
        MessageAttributes: {
          event_type: {
            DataType: "String",
            StringValue: event.event_type,
          },
          event_id: {
            DataType: "String",
            StringValue: event.event_id,
          },
        },
      });

      await sns.send(command);
    },
  };
}
