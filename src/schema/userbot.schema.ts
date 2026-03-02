
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

export type UFastBotDocument = UFastBot & Document

@Schema({timestamps: true, versionKey: false})
export class UFastBot {
 @Prop()
 userChatId: number

 @Prop()
 username: string

 @Prop({default: ""})
 location: string

 @Prop({default: ""})
phone_number: string

}

export const userbotschema = SchemaFactory.createForClass(UFastBot)