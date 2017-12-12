var self = module.exports = {};

var AWS = require('aws-sdk');

AWS.config.update({
    region: process.env.AWS_REGION
});

//Configurar AWS
self.getServerInfo = function(instanceId, callback) {
    console.log('-- Getting Server Info');

    var ec2 = new AWS.EC2();

    ec2.describeInstances({
        InstanceIds: [instanceId]
    }, function(err, data) {
        if (typeof callback === 'function') {
            callback(data);
        }
    });

};

self.completeLifecycleAction = function(event_detail, callback) {
    console.log('-- Sending Complete LifeCycle Action');

    var autoscaling = new AWS.AutoScaling();

    autoscaling.completeLifecycleAction({
        AutoScalingGroupName: event_detail.AutoScalingGroupName,
        LifecycleActionResult: 'CONTINUE',
        LifecycleHookName: event_detail.LifecycleHookName,
        InstanceId: event_detail.EC2InstanceId
    }, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else console.log('-- Lifecycle Action sended successfuly. '); // successful response
    });

}

self.createCloudWatchEventsRule = function(event_detail, context, server, callback) {
    console.log('-- Creating CloudWatch Rule');

    var cloudwatchevents = new AWS.CloudWatchEvents();

    cloudwatchevents.putRule({
        Name: 'ForgeAutoScaling-' + server.id,
        ScheduleExpression: 'cron(0/2 * * * ? *)',

        State: 'ENABLED'
    }, function(err, data) {
        if (err) {
            console.log(err, err.stack); // an error occurred
        } else {
            console.log('-- Created CloudWatch Rule'); // successful response
            self.createCloudWatchEventsTarget(event_detail, context, server, callback);
            self.addPermissionToLambda(context, data.RuleArn, callback);
        }

    });
}
self.disableCloudWatchEventsRule = function(server) {
    console.log('-- Disabling CloudWatch Rule');

    var cloudwatchevents = new AWS.CloudWatchEvents();

    cloudwatchevents.disableRule({
        Name: 'ForgeAutoScaling-' + server.id
    }, function(err, data) {
        if (err) {
            console.log(err, err.stack); // an error occurred
        } else {
            console.log('-- Disabled'); // successful response
        }
    });
}

self.createCloudWatchEventsTarget = function(parent_event_detail, context, server, callback) {
    console.log('-- Attaching Target to Rule');

    var cloudwatchevents = new AWS.CloudWatchEvents();

    cloudwatchevents.putTargets({
        Rule: 'ForgeAutoScaling-' + server.id,
        Targets: [
            {
                Arn: context.invokedFunctionArn,
                Id: '1',
                Input: JSON.stringify({
                    server: server,
                    lifecycle_detail: parent_event_detail
                })
            }
        ]
    }, function(err, data) {
        if (err) {
            console.log(err, err.stack); // an error occurred
        } else {
            console.log('-- Attached'); // successful response
        }
    });
}

self.addPermissionToLambda = function(context, source, callback) {
    console.log('-- Adding Permissions to Lambda Function');

    var lambda = new AWS.Lambda();

    lambda.addPermission({
        Action: "lambda:InvokeFunction",
        FunctionName: context.invokedFunctionArn,
        Principal: "events.amazonaws.com",
        SourceArn: source,
        StatementId: "1"
    }, function(err, data) {
        if (err) {
            console.log(err, err.stack); // an error occurred
        } else {
            console.log('-- Added'); // successful response
        }
    });
}