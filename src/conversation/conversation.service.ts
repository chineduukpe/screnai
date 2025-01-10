import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/services/user.service';
import { SlackService } from 'src/utilities/services/slack.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepo: Repository<Conversation>,
    private userService: UserService,
    private slackService: SlackService,
  ) {}

  async findOrCreateConversation(data: CreateConversationDto, userId: string) {
    const user = await this.userService.findOne(userId);
    const conversation = await this.conversationRepo.findOne({
      where: {
        conversationId: data?.conversationId,
      },
      relations: ['deal'],
    });

    if (!conversation) {
      const newConversation = await this.conversationRepo.save({
        ...data,
        organizationId: user?.organizationId,
      });
      this.slackService.sendNewConversationNotification({
        userFullName: `${user?.lastName} ${user?.firstName}`,
        email: user?.email,
        organizationId: user?.organizationId,
        conversationId: data?.conversationId,
      });
      return newConversation;
    }

    return conversation;
  }

  async findAll(userId: string) {
    const user = await this.userService.findOne(userId);

    return await this.conversationRepo.find({
      where: {
        organizationId: user?.organizationId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(conversationId: string) {
    return await this.conversationRepo.findOne({
      where: {
        conversationId,
      },
    });
  }

  async findOneByIdOrUUID(id: string) {
    const numericId = Number(id);
    const condition = isNaN(numericId)
      ? { conversationId: id }
      : [{ id: numericId }, { conversationId: id }];

    return await this.conversationRepo.findOne({
      where: condition,
    });
  }

  async update(id: number, updateConversationDto: any) {
    const updated = await this.conversationRepo.save(updateConversationDto);

    return updated;
  }

  async updateConversation(
    id: number,
    updateConversationDto: Partial<Conversation>,
  ) {
    return await this.conversationRepo.update(id, updateConversationDto);
  }

  remove(id: number) {
    return `This action removes a #${id} conversation`;
  }
}
