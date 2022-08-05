// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.qnaMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions);
       
        // create a DentistScheduler connector
        this.dentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration)
      
        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.qnaMaker.getAnswers(context);
          
            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);
                     
            // determine which service to respond with based on the results from LUIS //

            // if(top intent is intentA and confidence greater than 50){
            //  doSomething();
            //  await context.sendActivity();
            //  await next();
            //  return;
            // }
            // else {...}
            if (LuisResult.luisResult.prediction.topIntent === "ScheduleAppointment" &&
                LuisResult.intents.ScheduleAppointment.score > .5 &&
                LuisResult.entities.$instance &&
                LuisResult.entities.$instance.date_time &&
                LuisResult.entities.$instance.date_time[0]
            ) {
                const date_time = LuisResult.entities.$instance.date_time[0].text;
                // call api with location entity info
                const getDateTimeOfAppointment = await this.dentistScheduler.scheduleAppointment(date_time);
                console.log(getDateTimeOfAppointment)
                await context.sendActivity(getDateTimeOfAppointment);
                await next();
                return;
            }
            // If an answer was received from QnA Maker, send the answer back to the user.
            else if (qnaResults[0].score > .5) {
                console.log(qnaResults[0])
                await context.sendActivity(`${qnaResults[0].answer}`);
            }
            else {
                // If no answers were returned from QnA Maker, reply with help.
                await context.sendActivity(`I'm not sure I found an answer to your question`);
            }

            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Welcome to Nayanex Dentist Assistant. I can help you to book an appointment with a dentist or check their availabilities.';
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;
