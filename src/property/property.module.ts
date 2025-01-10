import { Module } from '@nestjs/common';
import { PropertyService } from './services/property.service';
import { PropertyController } from './controllers/property.controller';
import { Property } from './entities/property.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
  imports: [TypeOrmModule.forFeature([Property])],
})
export class PropertyModule {}
