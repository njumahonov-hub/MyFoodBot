import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import TelegramBot from "node-telegram-bot-api";
import { Orders, OredrsDocument } from "src/schema/order.bot.schema";
import { Foodsbot, FoodsbotDocument } from "src/schema/productbot.schema";
import { UFastBot, UFastBotDocument } from "src/schema/userbot.schema";
import { Waterbot, WaterDocument } from "src/schema/water.schema";

@Injectable()
export class BotService implements OnModuleInit {
    private bot: TelegramBot

    constructor(
        @InjectModel(UFastBot.name) private userBotModel: Model<UFastBotDocument>,
        @InjectModel(Foodsbot.name) private foodBotModel: Model<FoodsbotDocument>,
        @InjectModel(Orders.name) private ordersBotModel: Model<OredrsDocument>,
        @InjectModel(Waterbot.name) private waterBotModel: Model<WaterDocument>,
    ) {
        this.bot = new TelegramBot(process.env.BOT_TOKEN as string, {polling: true})

    }

    
    onModuleInit() {
        this.handleMessages();
    }
private handleMessages() {
  this.bot.onText(/\/start/, async (msg) => {

    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name;
    await this.userBotModel.create({userChatId: chatId, username: firstName})

    // Salomlashish va tugmalarni chiqarish
    await this.bot.sendMessage(chatId, `Assalomu alaykum, ${firstName}! Xush kelibsiz.`, {
      reply_markup: {
        keyboard: [
          [
            { text: "📞 Telefon raqamni yuborish", request_contact: true },
            { text: "📍 Manzilni yuborish", request_location: true }
          ],
          [
            { text: "🍔 Fast-Foods" },
             { text:  '🥤 Ichimliklar' }  // Bu oddiy matnli tugma
          ]
        ],
        resize_keyboard: true, // Tugmalarni kichraytirish
        one_time_keyboard: false // Bosgandan keyin yo'qolmasligi uchun
      }
    });
  });

 this.bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact!.phone_number;

  const user = await this.userBotModel.findOne({ userChatId: chatId });

  if (user) {
    if (user.phone_number) {
      await this.bot.sendMessage(chatId, `Sizning raqamingiz tizimda mavjud: ${user.phone_number} ⚠️`);
    } else {
      user.phone_number = phone;
      await user.save();
      await this.bot.sendMessage(chatId, `Raqamingiz muvaffaqiyatli saqlandi: ${phone} ✅`);
    }
  } else {
    await this.userBotModel.create({
      userChatId: chatId,
      phone_number: phone,
      username: msg.from?.username
    });
    await this.bot.sendMessage(chatId, "Ma'lumotlaringiz saqlandi! ✅");
  }
});
this.bot.on('location', async (msg) => {
  const chatId = msg.chat.id;
  const location = msg.location;

  if (!location) return;

  const locationStr = `${location.latitude},${location.longitude}`;

  await this.userBotModel.findOneAndUpdate(
    { userChatId: chatId },
    { location: locationStr }
  );

  await this.bot.sendMessage(chatId, "Manzilingiz qabul qilindi va yangilandi! ✅");
});

this.bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
if (msg.text === '🍔 Fast-Foods') {
  try {
    const user = await this.userBotModel.findOne({ userChatId: chatId });
    if (!user) return;

    if (!user.phone_number) {
      return this.bot.sendMessage(chatId, "Iltimos, telefon raqamingizni yuboring:");
    }

    // 2. Lokatsiyasi bormi?
    if (!user.location) {
      return this.bot.sendMessage(chatId, "Endi, yetkazib berish uchun manzilini (lokatsiya) yuboring:"
     );
    }
    const products = await this.foodBotModel.find({ isActive: true });

    if (products.length === 0) {
      return this.bot.sendMessage(chatId, "Hozircha menyu bo'sh.");
    }

    const defaultPhoto = "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=1000";

    const mainPhoto = products[0]?.image_url || defaultPhoto;

    let menuMessage = "<b>🍴 Bizning Menyu:</b>\n\n";
    const keyboard: any[][] = [];

    products.forEach((product) => {
      menuMessage += `🔸 <b>${product.title}</b> — ${product.price.toLocaleString()} so'm\n`;
      keyboard.push([{ 
        text: `🛒 ${product.title} (+1)`, 
        callback_data: `add_${product._id}` 
      }]);
    });

    try {
      await this.bot.sendPhoto(chatId, mainPhoto, {
        caption: menuMessage,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (photoError) {
      console.error("Rasm yuklashda xato:", photoError.message);
      await this.bot.sendMessage(chatId, menuMessage, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
    }

  } catch (error) {
    console.error("Umumiy xatolik:", error);
  }
}
});

this.bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  const data = query.data; // Masalan: "add_64abc123..."

  if (!chatId) return;

  if (data?.startsWith('add_')) {
    try {
      const productId = data.replace('add_', '');

      // 1. Foydalanuvchini bazadan topamiz
      const user = await this.userBotModel.findOne({ userChatId: chatId });

      if (!user) {
        return this.bot.answerCallbackQuery(query.id, { 
          text: "Iltimos, avval /start bosing! ⚠️", 
          show_alert: true 
        });
      }



      // 2. Tekshiramiz: Bu mahsulot savatda (pending statusda) bormi?
      const existingOrder = await this.ordersBotModel.findOne({
        user_id: user._id,
        product_id: productId,
        status: 'pending'
      });

      if (existingOrder) {
        // Agar bor bo'lsa, shunchaki sonini +1 qilamiz
        existingOrder.count += 1;
        await existingOrder.save();
      } else {
        // Agar yo'q bo'lsa, yangi order yaratamiz
        await this.ordersBotModel.create({
          user_id: user._id,
          product_id: productId,
          count: 1,
          status: 'pending'
        });
      }

      // 3. Foydalanuvchiga muvaffaqiyatli xabarini ko'rsatamiz
      await this.bot.answerCallbackQuery(query.id, { 
        text: "Savatga qo'shildi! ✅", 
        show_alert: false 
      });

      // 4. Pastda savatga o'tish tugmasini chiqarish
      await this.bot.sendMessage(chatId, "Yana biror narsa qo'shamizmi?", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Savatni ko'rish", callback_data: "show_cart" }],
            [{ text: "🚖 Buyurtmani yakunlash", callback_data: "checkout" }]
          ]
        }
      });

    } catch (error) {
      console.error("Order create error:", error);
      await this.bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi ❌" });
    }
  }

  if (data === 'show_cart') {
  const user = await this.userBotModel.findOne({ userChatId: chatId });
  if (!user) return;

  // Savatdagi mahsulotlarni olamiz
  const orders = await this.ordersBotModel.find({ 
    user_id: user._id as any, 
    status: 'pending' 
  }).populate('product_id');

  if (orders.length === 0) {
    return this.bot.sendMessage(chatId, "Savatchangiz bo'sh. 🛒");
  }

  let cartText = "<b>🛒 Sizning savatchangiz:</b>\n\n";
  let totalSum = 0;

  orders.forEach((order: any, index: number) => {
    const product = order.product_id;
    const itemTotal = product.price * order.count;
    totalSum += itemTotal;

    cartText += `${index + 1}. <b>${product.title}</b>\n`;
    cartText += `   ${order.count} x ${product.price.toLocaleString()} = ${itemTotal.toLocaleString()} so'm\n`;
  });

  cartText += `\n<b>Jami: ${totalSum.toLocaleString()} so'm</b>`;

  await this.bot.sendMessage(chatId, cartText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Buyurtmani tasdiqlash", callback_data: "final_confirm" }],
        [{ text: "🗑 Savatni tozalash", callback_data: "clear_cart" }]
      ]
    }
  });
}
if (data === 'checkout' ||data === 'final_confirm') {
  const user = await this.userBotModel.findOne({ userChatId: chatId });
  if (!user) return;

  // 1. Statusni yangilaymiz
  await this.ordersBotModel.updateMany(
    { user_id: user._id as any, status: 'pending' },
    { $set: { status: 'confirmed' } }
  );

  // 2. Mijozga xabar
  await this.bot.sendMessage(chatId, "<b>Buyurtmangiz muvaffaqiyatli qabul qilindi!</b> ✅\n\nTez orada operatorimiz siz bilan bog'lanadi. 📞", {
    parse_mode: 'HTML'
  });


}

if (data === 'clear_cart') {
  try {
    const user = await this.userBotModel.findOne({ userChatId: chatId });
    if (!user) return;

    await this.ordersBotModel.deleteMany({ 
      user_id: user._id as any, 
      status: 'pending' 
    });

    await this.bot.answerCallbackQuery(query.id, { text: "Savatchangiz tozalandi! 🗑" });
    
    // Savat xabarini o'chirish yoki tahrirlash
    await this.bot.editMessageText("Savatchangiz bo'shatildi. 🛒", {
      chat_id: chatId,
      message_id: query.message?.message_id
    });

  } catch (error) {
    console.error("Savatni tozalashda xato:", error);
  }
}
});

this.bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
if (msg.text === '🥤 Ichimliklar') {
  try {

     const user = await this.userBotModel.findOne({ userChatId: chatId });
    if (!user) return;

    if (!user.phone_number) {
      return this.bot.sendMessage(chatId, "Iltimos, telefon raqamingizni yuboring:");
    }

    // 2. Lokatsiyasi bormi?
    if (!user.location) {
      return this.bot.sendMessage(chatId, "Endi, yetkazib berish uchun manzilini (lokatsiya) yuboring:"
     );}
    
    const products = await this.waterBotModel.find({ isActive: true });

    if (products.length === 0) {
      return this.bot.sendMessage(chatId, "Hozircha menyu bo'sh.");
    }

const waterPhoto = "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=1000"

    const mainPhoto = products[0]?.image_url || waterPhoto;

    let menuMessage = "<b>🍴 Bizning Menyu:</b>\n\n";
    const keyboard: any[][] = [];

    products.forEach((product) => {
      menuMessage += `🔸 <b>${product.title}</b> — ${product.price.toLocaleString()} so'm\n`;
      keyboard.push([{ 
        text: `🛒 ${product.title} (+1)`, 
        callback_data: `add_${product._id}` 
      }]);
    });

    try {
      await this.bot.sendPhoto(chatId, mainPhoto, {
        caption: menuMessage,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (photoError) {
      console.error("Rasm yuklashda xato:", photoError.message);
      await this.bot.sendMessage(chatId, menuMessage, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
    }

  } catch (error) {
    console.error("Umumiy xatolik:", error);
  }
}
});

// Avvalgi listenerlarni o'chirib, yangisini o'rnatamiz (takrorlanishni oldini oladi)
this.bot.removeAllListeners('callback_query');

this.bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  const data = query.data;

  if (!chatId || !data) return;

  try {
    // 1. SAVATGA QO'SHISH (add_...)
    if (data.startsWith('add_')) {
      const productId = data.replace('add_', '');
      const user = await this.userBotModel.findOne({ userChatId: chatId });
      
      if (!user) {
        return this.bot.answerCallbackQuery(query.id, { text: "Avval /start bosing!", show_alert: true });
      }

      // Suv yoki Ovqatligini aniqlash
      const isWater = await this.waterBotModel.findById(productId);
      
      // Filter: faqat pending bo'lgan xuddi shu mahsulotni qidiramiz
      const filter = isWater 
        ? { user_id: user._id, water_id: productId, status: 'pending' }
        : { user_id: user._id, product_id: productId, status: 'pending' };

      const existingOrder = await this.ordersBotModel.findOne(filter);

      if (existingOrder) {
        await this.ordersBotModel.updateOne({ _id: existingOrder._id }, { $inc: { count: 1 } });
      } else {
        await this.ordersBotModel.create({
          user_id: user._id,
          [isWater ? 'water_id' : 'product_id']: productId,
          count: 1,
          status: 'pending'
        });
      }

      await this.bot.answerCallbackQuery(query.id, { text: "Savatga qo'shildi! ✅" });
      await this.bot.sendMessage(chatId, "Yana biror narsa qo'shamizmi?", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Savatni ko'rish", callback_data: "show_cart" }],
            [{ text: "🚖 Buyurtmani yakunlash", callback_data: "checkout" }]
          ]
        }
      });
    }

    // 2. SAVATNI KO'RSATISH
    else if (data === 'show_cart') {
      const user = await this.userBotModel.findOne({ userChatId: chatId });
      const orders = await this.ordersBotModel.find({ user_id: user?._id, status: 'pending' })
        .populate('product_id')
        .populate('water_id');

      if (!orders.length) {
        return this.bot.answerCallbackQuery(query.id, { text: "Savatchangiz bo'sh! 🛒", show_alert: true });
      }

      let cartText = "<b>🛒 Savatchangiz:</b>\n\n";
      let total = 0;

      orders.forEach((o: any, i) => {
        const item = o.product_id || o.water_id;
        if (item) {
          const sum = item.price * o.count;
          total += sum;
          cartText += `${i+1}. <b>${item.title}</b>\n   ${o.count} x ${item.price.toLocaleString()} = ${sum.toLocaleString()} so'm\n\n`;
        }
      });

      cartText += `<b>Jami: ${total.toLocaleString()} so'm</b>`;

      await this.bot.answerCallbackQuery(query.id);
      await this.bot.sendMessage(chatId, cartText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Tasdiqlash", callback_data: "final_confirm" }],
            [{ text: "🗑 Tozalash", callback_data: "clear_cart" }]
          ]
        }
      });
    }
    else if (data === 'clear_cart') {
  try {
    // 1. Foydalanuvchini bazadan topamiz
    const user = await this.userBotModel.findOne({ userChatId: chatId });
    if (!user) return;

    // 2. Ushbu foydalanuvchiga tegishli barcha 'pending' buyurtmalarni o'chiramiz
    const deleteResult = await this.ordersBotModel.deleteMany({ 
      user_id: user._id, 
      status: 'pending' 
    });

    // 3. Foydalanuvchiga "yuklanish" holatini to'xtatish uchun javob qaytaramiz
    await this.bot.answerCallbackQuery(query.id, { 
      text: "Savatchangiz muvaffaqiyatli tozalandi! 🗑", 
      show_alert: false 
    });

    // 4. Ekrindagi savatcha xabarini o'zgartiramiz (tozalanganini ko'rsatish uchun)
    await this.bot.editMessageText("Savatchangiz bo'shatildi. 🛒\n\nYangi buyurtma qilish uchun menyudan foydalaning.", {
      chat_id: chatId,
      message_id: query.message?.message_id,
      parse_mode: 'HTML'
    });

  } catch (error) {
    console.error("Savatni tozalashda xatolik:", error);
    await this.bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi ❌" });
  }
}

    // 3. BUYURTMANI YAKUNLASH
    else if (data === 'final_confirm' || data === 'checkout') {
      const user = await this.userBotModel.findOne({ userChatId: chatId });
      await this.ordersBotModel.updateMany({ user_id: user?._id, status: 'pending' }, { status: 'confirmed' });

      await this.bot.answerCallbackQuery(query.id);
      await this.bot.sendMessage(chatId, "✅ Buyurtmangiz qabul qilindi!");
    }

  } catch (error) {
    console.error("Callback xatosi:", error);
    await this.bot.answerCallbackQuery(query.id).catch(() => {});
  }

  
});





}
    
}