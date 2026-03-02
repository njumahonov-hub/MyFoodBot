
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

export type FoodsbotDocument = Foodsbot & Document

@Schema({timestamps: true, versionKey: false})
export class Foodsbot {
 @Prop()
 price: number

 @Prop()
 title: string

 @Prop()
 image_url: string

 @Prop({default: true})
 isActive: boolean
}

export const productbotschema = SchemaFactory.createForClass(Foodsbot)