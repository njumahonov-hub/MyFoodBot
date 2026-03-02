import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { orderbotschema, Orders } from 'src/schema/order.bot.schema';
import { Foodsbot, productbotschema } from 'src/schema/productbot.schema';
import { UFastBot, userbotschema } from 'src/schema/userbot.schema';
import { BotService } from './bot.service';
import { Waterbot, watertbotschema } from 'src/schema/water.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UFastBot.name, schema: userbotschema },
      { name: Foodsbot.name, schema: productbotschema },
      { name: Orders.name, schema: orderbotschema },
      {name: Waterbot.name, schema: watertbotschema}
    ]),
  ],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}