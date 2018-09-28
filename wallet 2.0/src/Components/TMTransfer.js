import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import { sendAmount, getTMBalance } from '../Actions/tendermint.action';
import { payVPNSession, getSessionInfo } from './../Actions/tmvpn.action';
import { payVPNTM, setVpnStatus, setActiveVpn } from '../Actions/vpnlist.action';
import { connectVPN, checkVPNDependencies } from './../Actions/connectOVPN';
import CustomTextField from './customTextfield';
import { Button, Snackbar } from '@material-ui/core';
import { createAccountStyle } from '../Assets/createtm.styles';
import { accountStyles } from '../Assets/tmaccount.styles';
import { withStyles } from '@material-ui/core/styles';
import { compose } from 'recompose';
import OpenvpnAlert from './OpenvpnAlert';

const electron = window.require('electron');
const remote = electron.remote;


const Customstyles = theme => ({
    button: {
        margin: theme.spacing.unit,
    }
});

class TMTransfer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            toAddress: '',
            keyPassword: '',
            amount: '',
            openSnack: false,
            snackMessage: '',
            isTextDisabled: false,
            sending: false,
            openvpnAlert: false
        }
    }

    componentWillMount = () => {
    }

    componentWillReceiveProps = (nextProps) => {
        if (nextProps.vpnPayment.isPayment) {
            this.setState({ toAddress: nextProps.vpnPayment.data.vpn_addr, amount: 100, isTextDisabled: true })
        }
        else {
            this.setState({ isTextDisabled: false })
        }
    }

    handleDialogClose = () => {
        this.setState({ openvpnAlert: false });
    }

    sendTransaction = () => {
        this.setState({ sending: true })
        if (this.props.vpnPayment.isPayment) {
            checkVPNDependencies(remote.process.platform, (otherErr, winErr) => {
                if (otherErr) {
                    this.setState({ sending: false, openSnack: true, snackMessage: otherErr.message });
                }
                else if (winErr) {
                    this.setState({ sending: false, openvpnAlert: true })
                }
                else {
                    let data = {
                        "amount": (parseInt(this.state.amount) * (10 ** 8)).toString() + 'sut',
                        "name": this.props.account.name,
                        "password": this.state.keyPassword,
                        "gas": 200000,
                        "vaddress": this.state.toAddress,
                        "sig_name": Math.random().toString(36).substring(4),
                        "sig_password": Math.random().toString(36).substring(2)
                    }
                    this.props.payVPNSession(data).then(response => {
                        if (response.error) {
                            console.log("Pay VPN Error...", response);
                            this.setState({ sending: false, openSnack: true, snackMessage: 'Transaction Failed' });
                        }
                        else {
                            localStorage.setItem('SIGNAME', data.sig_name)
                            localStorage.setItem('SIGPWD', data.sig_password)
                            this.props.getSessionInfo(response.payload.hash).then(sesRes => {
                                if (sesRes.error) {
                                    console.log("Ses..Error", sesRes.error);
                                    this.setState({ sending: false, openSnack: true, snackMessage: 'Something went wrong' });
                                }
                                else {
                                    let data = sesRes.payload;
                                    let vpn_data = this.props.vpnPayment.data;
                                    let session_data = sesRes.payload
                                    connectVPN(this.props.account.address, vpn_data, remote.process.platform, session_data, (err, platformErr, res) => {
                                        console.log("VPN Response...", err, platformErr, res);
                                        if (err) {
                                            console.log("Connect VPN Err...", err, platformErr, res);
                                            this.setState({ sending: false, openSnack: true, snackMessage: err.message });
                                        }
                                        else {
                                            this.props.setActiveVpn(vpn_data);
                                            localStorage.setItem('lockedAmount', 100);
                                            this.props.setVpnStatus(true);
                                            this.setState({ sending: false, toAddress: '', keyPassword: '', amount: '', openSnack: true, snackMessage: 'Connected VPN' });
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
        else {
            let data = {
                "amount": (parseInt(this.state.amount) * (10 ** 8)).toString() + 'sut',
                "name": this.props.account.name,
                "password": this.state.keyPassword,
                "gas": 200000,
                "to": this.state.toAddress
            }
            this.props.sendAmount(data, this.state.toAddress).then(response => {
                if (response.error) {
                    this.setState({ sending: false, openSnack: true, snackMessage: 'Transaction Failed' });
                }
                else {
                    this.setState({
                        sending: false, openSnack: true, snackMessage: 'Transaction done successfully',
                        toAddress: '', keyPassword: '', amount: '',
                    });
                }
            });
        }
    }

    handleClose = (event, reason) => {
        this.setState({ openSnack: false });
    };

    render() {
        const { classes } = this.props;
        return (
            <div style={accountStyles.formStyle}>
                <div style={createAccountStyle.secondDivStyle}>
                    <p style={createAccountStyle.headingStyle}>To Address</p>
                    <CustomTextField type={'text'} placeholder={''} disabled={this.state.isTextDisabled}
                        value={this.state.toAddress} onChange={(e) => { this.setState({ toAddress: e.target.value }) }}
                    />
                    <p style={createAccountStyle.headingStyle}>Amount</p>
                    <CustomTextField type={'number'} placeholder={''} disabled={this.state.isTextDisabled}
                        value={this.state.amount} onChange={(e) => { this.setState({ amount: e.target.value }) }}
                    />
                    <p style={createAccountStyle.headingStyle}>Account Password</p>
                    <CustomTextField type={'password'} placeholder={''} disabled={false}
                        value={this.state.keyPassword} onChange={(e) => { this.setState({ keyPassword: e.target.value }) }}
                    />
                    <Button
                        variant="outlined"
                        color="primary"
                        disabled={this.state.sending}
                        onClick={() => { this.sendTransaction() }}
                        className={classes.button} style={createAccountStyle.buttonStyle}>
                        {this.state.sending ? 'Sending' : 'Send'}
                    </Button>
                </div>
                <Snackbar
                    open={this.state.openSnack}
                    autoHideDuration={4000}
                    onClose={this.handleClose}
                    message={this.state.snackMessage}
                />
                <OpenvpnAlert
                    open={this.state.openvpnAlert}
                    onClose={this.handleDialogClose}
                />
            </div>
        )
    }
}

TMTransfer.propTypes = {
    classes: PropTypes.object.isRequired,
};


function mapStateToProps(state) {
    return {
        lang: state.setLanguage,
        isTest: state.setTestNet,
        account: state.setTMAccount,
        vpnPayment: state.payVPNTM
    }
}

function mapDispatchToActions(dispatch) {
    return bindActionCreators({
        sendAmount,
        getTMBalance,
        payVPNTM,
        payVPNSession,
        getSessionInfo,
        setVpnStatus,
        setActiveVpn
    }, dispatch)
}

export default compose(withStyles(Customstyles), connect(mapStateToProps, mapDispatchToActions))(TMTransfer);