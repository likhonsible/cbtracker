
import { Component, OnDestroy, OnInit } from '@angular/core';

import { EventService } from 'src/app/services/event.service';
import { Web3Service } from 'src/app/services/web3.service';
import { GroupService } from 'src/app/services/group.service';
import { CurrencyService } from 'src/app/services/currency.service';


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  isLoading = true
  isLoadingCurrency = true
  isGen2 = false
  treasuryContract: any
  multicallContract: any
  accounts: any[] = []

  nfts = {
    characters: 0,
    weapons: 0,
    shields: 0
  }

  prices = {
    gas: 0,
    skill: 0,
    valor: 0
  }

  balances = {
    gas: 0,
    wallet: 0,
    unclaimed: 0,
    claimable: 0
  }

  constructor(
    private eventService: EventService,
     public web3Service: Web3Service,
     public groupService: GroupService,
     public currencyService: CurrencyService
     ) {
    this.accounts = this.groupService.getActiveGroupAccounts()
  }

  default() {
    this.nfts = {
      characters: 0,
      weapons: 0,
      shields: 0
    }

    this.prices = {
      gas: 0,
      skill: 0,
      valor: 0
    }

    this.balances = {
      gas: 0,
      wallet: 0,
      unclaimed: 0,
      claimable: 0
    }
  }

  ngOnInit(): void {
    this.default()
    this.loadData()
    this.eventService.subscribe('chain_changed', () => {
      this.loadData()
    })
    this.eventService.subscribe('currency_changed', () => {
      this.loadPrices()
    })
  }

  ngOnDestroy(): void {
    this.eventService.destroy('currency_changed')
    this.eventService.destroy('chain_changed')
  }

  formatPrice(val: number) {
    return val.toLocaleString('en-US', { style: 'currency', currency: this.currencyService.activeCurrency.toUpperCase() })
  }

  formatNumber(val: number, decimal = 4) {
    return val.toLocaleString('en-US', { minimumFractionDigits: decimal })
  }

  async loadData() {
    const time = new Date().getTime()
    this.isLoading = true
    this.treasuryContract = this.web3Service.getContract(this.web3Service.activeChain, 'treasury')
    this.multicallContract = this.web3Service.getMulticall(this.web3Service.activeChain)

    if (this.accounts.length > 0) {
      const balanceCall = this.accounts.map((address: string) => {
        return {
          reference: address,
          methodName: 'balanceOf',
          methodParameters: [address]
        }
      })
      const calls = [];
      for (const nft of ['characters', 'weapons', 'shields']) {
        calls.push({
          reference: nft,
          contractAddress: this.web3Service.getOtherContractAddress(this.web3Service.activeChain, nft),
          abi: this.web3Service.abis[nft],
          calls: balanceCall
        })
      }
      const results = this.web3Service.parseMulticallResult(await this.multicallContract.call(calls))
      this.nfts.characters = results.characters.reduce((a: number, b: any) => a + this.web3Service.multicallBnToNumber(b[0]), 0)
      this.nfts.weapons = results.weapons.reduce((a: number, b: any) => a + this.web3Service.multicallBnToNumber(b[0]), 0)
      this.nfts.shields = results.shields.reduce((a: number, b: any) => a + this.web3Service.multicallBnToNumber(b[0]), 0)
    }
    await this.loadPrices()
    await this.loadBalances()
    this.isLoading = false
    console.log(new Date().getTime() - time)
  }

  async loadPrices() {
    this.isLoadingCurrency = true
    this.prices = {
      gas: 0,
      skill: 0,
      valor: 0
    }
    this.prices = await this.currencyService.loadPrices(this.web3Service.activeChain)
    this.isLoadingCurrency = false
  }

  async loadBalances() {
    if (this.accounts.length > 0) {
      const accountBalances: any = await this.web3Service.getAccountBalances(this.accounts, false)
      this.balances.gas = accountBalances.reduce((a: number, b: any) => a + +b.gas, 0)
      this.balances.wallet = accountBalances.reduce((a: number, b: any) => a + b.wallet, 0)
      this.balances.unclaimed = accountBalances.reduce((a: number, b: any) => a + b.unclaimed, 0)
      this.balances.claimable = accountBalances.reduce((a: number, b: any) => a + b.claimable, 0)
    }
  }

}