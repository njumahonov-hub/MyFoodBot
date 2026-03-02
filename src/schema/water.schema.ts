
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

export type WaterDocument = Waterbot & Document

@Schema({timestamps: true, versionKey: false})
export class Waterbot {
 @Prop()
 price: number

 @Prop()
 title: string

 @Prop()
 image_url: string

 @Prop({default: true})
 isActive: boolean
}

export const watertbotschema = SchemaFactory.createForClass(Waterbot)