import * as express from 'express';
import { getVehicleNumber } from '../controller/queryController';

export const queryRouter = express.Router();

queryRouter.post('/vehicleid/:vehicleid', (req, res) => {
    return getVehicleNumber(req, res);
});
