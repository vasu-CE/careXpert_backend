interface MessageData {
  senderId?: string;
  username: string;
  text: string;
  messageType?: "TEXT" | "IMAGE";
  imageUrl?: string;
}

interface FormattedMessage extends MessageData {
  createdAt: Date;
}

export function formatMessage(data: MessageData): FormattedMessage {
  return {
    ...data,
    messageType: data.messageType || "TEXT",
    createdAt: new Date(),
  };
}
