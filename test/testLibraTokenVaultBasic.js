import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert.js';
import { increaseTimeTo, duration } from 'zeppelin-solidity/test/helpers/increaseTime';
import ether from 'zeppelin-solidity/test/helpers/ether';
import latestTime from 'zeppelin-solidity/test/helpers/latestTime';

require('chai')
    .use(require('chai-as-promised'))
    .should();

const LibraToken = artifacts.require('LibraToken');
const LibraTokenVault = artifacts.require('LibraTokenVault');
const BigNumber = web3.BigNumber;

/** USE NODE 8.9.1 */

contract('LibraTokenVault', function ([_, owner, accounts]) {
    const totalSupply = (10 ** 9) * (10 ** 18);
    const vaultSupply = 5 * (10 ** 8) * (10 ** 18)
    const value = ether(5);
    const bigValue = ether(100);

    const teamReserveWallet = "0x3ECCAAF69d6B691589703756Ae216dE43BD5E4f1";
    const firstReserveWallet = "0x74F42e96651142FB8Ebb718882A3C25971dEcdb1";

    beforeEach(async function () {
        this.token = await LibraToken.new({ from: owner });
        this.vault = await LibraTokenVault.new(this.token.address, { from: owner })
        // teamReserveWallet.transfer({from: accounts[1], value: web3.toWei(100, "ether")});
    });

    describe('LibraTokenVault is deployed and', function () {

        it('Token matches', async function () {
            const vaultTokenAddr = await this.vault.token();

            vaultTokenAddr.should.equal(this.token.address);
        });

        it('is not locked', async function () {
            const _lockValue = await this.vault.lockedAt();

            _lockValue.toNumber(10).should.equal(0);
        });

        it('owner matches', async function () {
            const _owner = await this.vault.owner();

            _owner.should.equal(owner);
        });

        it('should reject payments', async function () {
            await this.vault.send(value).should.be.rejected;
        });



        // it('allocates correct token allocation values', async function () {
        /** allocations are internal */
        //     const totalAllocation = this.vault.totalAllocation();
        //     const teamReserveAllocation = this.vault.teamReserveAllocation();
        //     const firstReserveAllocation = this.vault.firstReserveAllocation();
        //     const secondReserveAllocation = this.vault.secondReserveAllocation();

        //     assert.equal(totalAllocation, 5 * (10 ** 8), 'total allocation not initialized correctly');
        //     assert.equal(teamReserveAllocation, 2 * (10 ** 8), 'teamReserve allocation not initialized correctly');
        //     assert.equal(firstReserveAllocation,  15 * (10 ** 7), 'firstReserve allocation not initialized correctly');
        //     assert.equal(secondReserveAllocation, 15 * (10 ** 7), 'secondReserve allocation not initialized correctly');
        // });
    });
    describe('Allocations', function () {
        it('owner must send tokens to vault before allocation', async function () {
            const vaultBalance = await this.vault.getTotalBalance();
            vaultBalance.toNumber(10).should.equal(0);
            await this.vault.allocate({ from: owner }).should.be.rejected;
        });
        it('non-owner cannot allocate', async function () {
            await this.vault.allocate({ from: accounts[1] }).should.be.rejected;

            /** tests that non-owner can't fund tokenvault and then allocate */
            // await this.token.transfer(accounts[1], totalSupply, {from: owner});
            // await this.token.transfer(this.vault.address, totalSupply, {from: accounts[1]});

            // const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
            // vaultTokenBalance.toNumber(10).should.equal(totalSupply);

            // await this.vault.allocate( {from: accounts[1]}).should.be.rejected;

        });
        it('owner can allocate', async function () {
            await this.token.transfer(this.vault.address, vaultSupply, { from: owner });
            const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
            vaultTokenBalance.toNumber(10).should.equal(vaultSupply);

            await this.vault.allocate({ from: owner }).should.be.fulfilled;
        });
        it('owner can recover failed lock before allocation', async function () {
            await this.vault.recoverFailedLock({ from: teamReserveWallet }).should.be.fulfilled;
            await this.vault.recoverFailedLock({ from: owner }).should.be.fulfilled;
        });
        it('owner can recover failed lock before allocation', async function () {

            await this.token.transfer(this.vault.address, vaultSupply, { from: owner });
            const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
            vaultTokenBalance.toNumber(10).should.equal(vaultSupply);
            await this.vault.allocate({ from: owner }).should.be.fulfilled;

            await this.vault.recoverFailedLock({ from: owner }).should.be.rejected;
        });
    });
    describe('Reserve Wallet', async function () {
        describe('of teamReserve', async function () {
            it('can\'t call locked balance before allocation', async function () {
                const tokensLocked = await this.vault.getLockedBalance({ from: teamReserveWallet }).should.be.rejected;
            });

            it('cannot claim team reserve before timelock', async function () {
                await this.vault.claimTeamReserve({ from: teamReserveWallet }).should.be.rejected;
            });

            it('cannot check team vesting before allocation', async function () {
                const stage = await this.vault.teamVestingStage({ from: teamReserveWallet }).should.be.rejected;
            })

            it('can call locked balance after allocation', async function () {
                await this.token.transfer(this.vault.address, vaultSupply, { from: owner });
                const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
                vaultTokenBalance.toNumber(10).should.equal(vaultSupply);
                await this.vault.allocate({ from: owner }).should.be.fulfilled;

                const tokensLocked = await this.vault.getLockedBalance({ from: teamReserveWallet }).should.be.fulfilled;
                const teamReserveAllocation = 2 * (10 ** 8)
                tokensLocked.toNumber(10).should.equal(teamReserveAllocation);
            });

            it('can check team vesting after allocation', async function () {
                await this.token.transfer(this.vault.address, vaultSupply, { from: owner });
                const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
                vaultTokenBalance.toNumber(10).should.equal(vaultSupply);
                await this.vault.allocate({ from: owner }).should.be.fulfilled;

                const stage0 = await this.vault.teamVestingStage({ from: teamReserveWallet });
                stage0.toNumber(10).should.equal(0);

                await increaseTimeTo(latestTime() + duration.days(100));
                const stage1 = await this.vault.teamVestingStage({ from: teamReserveWallet });
                stage1.toNumber(10).should.equal(1);

                await increaseTimeTo(latestTime() + duration.days(100));
                const stage2 = await this.vault.teamVestingStage({ from: teamReserveWallet });
                stage2.toNumber(10).should.equal(2);

                await increaseTimeTo(latestTime() + duration.days(100));
                const stage3 = await this.vault.teamVestingStage({ from: teamReserveWallet });
                stage3.toNumber(10).should.equal(3);

                await increaseTimeTo(latestTime() + duration.days(100));
                const stage4 = await this.vault.teamVestingStage({ from: teamReserveWallet });
                stage4.toNumber(10).should.equal(4);
            })

            it('can claim team reserve after timelock', async function () {
                await this.token.transfer(this.vault.address, vaultSupply, { from: owner });
                const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
                vaultTokenBalance.toNumber(10).should.equal(vaultSupply);
                await this.vault.allocate({ from: owner }).should.be.fulfilled;

                await this.vault.claimTeamReserve({ from: teamReserveWallet }).should.be.rejected;

                await increaseTimeTo(latestTime() + duration.days(365 + 1));
                await this.vault.claimTeamReserve({ from: teamReserveWallet }).should.be.fulfilled;
            });
        });

        describe('of tokenReserve', async function () {
            it('can\'t call locked balance before allocation', async function () {
                const tokensLocked = await this.vault.getLockedBalance({ from: firstReserveWallet }).should.be.rejected;
            });

            it('cannot claim token reserve before timelock', async function () {
                await this.vault.claimTokenReserve({ from: firstReserveWallet }).should.be.rejected;
            });

            it('cannot check if still locked tokens before allocation', async function () {
                await this.vault.canCollect({ from: firstReserveWallet }).should.be.rejected;
            });

            it('can call locked balance after allocation', async function () {
                await this.token.transfer(this.vault.address, vaultSupply, { from: owner });
                const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
                vaultTokenBalance.toNumber(10).should.equal(vaultSupply);
                await this.vault.allocate({ from: owner }).should.be.fulfilled;

                const tokensLocked = await this.vault.getLockedBalance({ from: firstReserveWallet }).should.be.fulfilled;
                const firstReserveAllocation = 15 * (10 ** 7);
                tokensLocked.toNumber(10).should.equal(firstReserveAllocation);
            });

            it('can check if still locked tokens after allocation', async function () {
                await this.token.transfer(this.vault.address, vaultSupply, { from: owner });
                const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
                vaultTokenBalance.toNumber(10).should.equal(vaultSupply);
                await this.vault.allocate({ from: owner }).should.be.fulfilled;

                const lockedBool = await this.vault.canCollect({ from: firstReserveWallet });
                lockedBool.should.equal(false);
            });

            it('can claim token reserve after timelock', async function () {
                await this.token.transfer(this.vault.address, vaultSupply, { from: owner });
                const vaultTokenBalance = await this.token.balanceOf(this.vault.address);
                vaultTokenBalance.toNumber(10).should.equal(vaultSupply);
                await this.vault.allocate({ from: owner }).should.be.fulfilled;

                await this.vault.claimTokenReserve({ from: firstReserveWallet }).should.be.rejected;

                await increaseTimeTo(latestTime() + duration.days(2 * 365 + 1));
                await this.vault.claimTokenReserve({ from: firstReserveWallet }).should.be.fulfilled;
            });
        });
    });

});