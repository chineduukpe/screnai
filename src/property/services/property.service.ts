import { Injectable } from '@nestjs/common';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { Property } from '../entities/property.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property) private propertyRepo: Repository<Property>,
  ) {}
  create(createPropertyDto: CreatePropertyDto) {
    return 'This action adds a new property';
  }

  findAll() {
    return `This action returns all property`;
  }

  findOne(id: number) {
    return `This action returns a #${id} property`;
  }

  async findOneByAddressOrId(
    address?: string,
    propertyId?: string,
  ): Promise<Property | null> {
    if (!address && !propertyId) {
      throw new Error('Either address or propertyId must be provided');
    }

    const where: any = {};
    if (propertyId) {
      where.helloDataID = propertyId;
    }

    if (address) {
      where.propertyAddress = address;
    }

    return await this.propertyRepo.findOne({
      where,
    });
  }

  async findOneByNameOrCreate(
    propertyAddress: string,
    propertyName: string,
    propertyID?: string,
  ): Promise<Property> {
    let propertyData: any;

    let property = await this.findOneByAddressOrId(propertyAddress, propertyID);

    if (!property) {
      const headers = { 'x-api-key': process.env.HELLO_DATA_API_KEY };

      if (propertyID && propertyID.trim() !== '') {
        const propertyUrl = `${process.env.HELLO_DATA_API_URL}/property/${propertyID}`;

        try {
          const response = await axios.get(propertyUrl, { headers });
          propertyData = response.data;

          property = await this.propertyRepo.save({
            propertyAddress,
            propertyName: propertyData.building_name || propertyName,
            yearBuilt: propertyData.year_built,
            noOfUnits: propertyData.number_units,
            city: propertyData.city,
            state: propertyData.state,
            zipCode: propertyData.zip_code,
            propertyMetrics: propertyData,
            helloDataID: propertyID,
          });
        } catch (error) {
          console.error('Error fetching detailed property data:', error);
          propertyData = {};
        }
      }
    }

    return property;
  }

  update(id: number, updatePropertyDto: UpdatePropertyDto) {
    return `This action updates a #${id} property`;
  }

  remove(id: number) {
    return `This action removes a #${id} property`;
  }
}
