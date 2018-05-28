import { Gpio } from 'onoff';
import { emitLocationData } from './server';
import moment from 'moment';

let IR1 = new Gpio(27, 'in', 'both');
let IR2 = new Gpio(17, 'in', 'both');
let IR3 = new Gpio(22, 'in', 'both');

export const startProcess = () => {

    IR1.watch((err, value) => {
        if (value === 1) {
            emitLocationData.emit("valueChanged", {location: "LOC1", date: moment()});
        } else {
            emitLocationData.emit("valueChanged", {location: "LOC1", date: null});
        }
    });

    IR2.watch((err, value) => {
        if (value === 1) {
            emitLocationData.emit("valueChanged", {location: "LOC2", date:  moment()});
        } else {
            emitLocationData.emit("valueChanged", {location: "LOC2", date: null});
        }
    });

    IR3.watch((err, value) => {
        if (value === 1) {
            emitLocationData.emit("valueChanged", {location: "LOC3", date: moment()});
        } else {
            emitLocationData.emit("valueChanged", {location: "LOC3", date: null});
        }
    })


    const unexport = () => {
        IR1.unwatch();
        IR1.unexport();
        IR2.unwatch();
        IR2.unexport();
        IR3.unwatch();
        IR3.unexport();
    };

}
