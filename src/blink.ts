import { Gpio } from 'onoff';
import { emitLocationData } from './server';

let IR1 = new Gpio(27, 'in', 'both');
let IR2 = new Gpio(17, 'in', 'both');
let IR3 = new Gpio(22, 'in', 'both');

export const startProcess = () => {

    IR1.watch((err, value) => {
        console.log(value);
        if (value === 1) {
            console.log("You are near, IR1");
            emitLocationData.emit("valueChanged", { locastion: "IR1", date: new Date() });
        } else {
            console.log("you are away, IR1");
        }
    });

    IR2.watch((err, value) => {
        console.log(value);
        if (value === 1) {
            console.log("You are near, IR2");
            emitLocationData.emit("valueChanged", { locastion: "IR2", date: new Date() });
        } else {
            console.log("you are away, IR2");
        }
    });

    IR3.watch((err, value) => {
        console.log(value);
        if (value === 1) {
            console.log("You are near , IR3");
            emitLocationData.emit("valueChanged", { locastion: "IR3", date: new Date() });
        } else {
            console.log("You are away, IR3");
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
