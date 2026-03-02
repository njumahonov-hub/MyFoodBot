import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";

export type OredrsDocument = Orders & Document;

@Schema({ timestamps: true, versionKey: false })
export class Orders {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'UFastBot', required: true })
  user_id: mongoose.Types.ObjectId; 

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Foodsbot',  })
  product_id: mongoose.Types.ObjectId;

  
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Waterbot',  })
  water_id: mongoose.Types.ObjectId;


  @Prop({ default: 1 })
  count: number;

  @Prop({ default: 'pending' })
  status: string;
}

export const orderbotschema = SchemaFactory.createForClass(Orders);