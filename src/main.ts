import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import axios from 'axios';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/', (req, res) => {
    res.send('Bot is active and running! 🚀');
  });
  await app.listen(process.env.PORT ?? 3000);
  const URL = 'https://myfoodbot.onrender.com/'; // O'z manzilingizni qo'ying
  setInterval(async () => {
    try {
      await axios.get(URL);
      console.log('Self-ping successful');
    } catch (e) {
      console.error('Self-ping failed');
    }
  }, 600000);
}
bootstrap();
